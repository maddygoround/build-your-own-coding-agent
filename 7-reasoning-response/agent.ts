import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline/promises";
import { console_reasoning, detectReasoningStage } from "./console-reasoning";
import { logger } from "../logger";
import { ToolDefinition, ReasoningStage, ReasoningState } from "./types";

export class Agent {
  private client: Anthropic;
  private rl: readline.Interface;
  private verbose: boolean;
  private tools: ToolDefinition[];
  private enableThinking: boolean;
  private collapseReasoning: boolean;
  private reasoningState: ReasoningState;

  constructor(
    client: Anthropic,
    rl: readline.Interface,
    tools: ToolDefinition[],
    options?: {
      verbose?: boolean;
      enableThinking?: boolean;
      collapseReasoning?: boolean;
    }
  ) {
    this.client = client;
    this.rl = rl;
    this.tools = tools;
    this.verbose = !!options?.verbose;
    this.enableThinking = options?.enableThinking ?? true;
    this.collapseReasoning = options?.collapseReasoning ?? false;

    this.reasoningState = {
      isActive: false,
      currentStage: null,
      accumulatedText: "",
      collapsed: this.collapseReasoning,
    };
  }

  async run() {
    const conversation: Anthropic.MessageParam[] = [];

    if (this.verbose) {
      logger.debug(
        "Conversation started with reasoning enabled:",
        this.enableThinking
      );
    }

    const bannerText = this.enableThinking
      ? "Chat with Claude (with Extended Thinking) - use 'ctrl-c' to quit"
      : "Chat with Claude - use 'ctrl-c' to quit";

    console_reasoning.banner(bannerText);

    while (true) {
      let userInput: string;
      try {
        userInput = await this.rl.question(
          console_reasoning.userPromptString()
        );
      } catch {
        if (this.verbose) {
          logger.debug("User input ended, breaking from chat loop");
        }
        break;
      }

      if (!userInput) {
        if (this.verbose) {
          logger.debug("Skipping empty message");
        }
        continue;
      }

      if (this.verbose) {
        logger.debug({ userInput }, "User input received");
      }

      conversation.push({ role: "user", content: userInput });

      if (this.verbose) {
        logger.debug(
          { conversationLength: conversation.length },
          "Sending message to Claude"
        );
      }

      try {
        let stream = await this.runInference(conversation);

        stream.on("streamEvent", (event) => {
          this.handleStreamEvent(event);
        });

        let message = await stream.finalMessage();
        conversation.push({ role: "assistant", content: message.content });

        while (true) {
          let hasToolUse = false;
          let toolsResults: Anthropic.ToolResultBlockParam[] = [];

          if (this.verbose) {
            logger.debug(
              { conversationLength: conversation.length },
              "Received response from Claude"
            );
          }

          for (const block of message.content) {
            if (block.type === "tool_use") {
              hasToolUse = true;
              const toolToUse = block.name;
              let toolResult: string | undefined;
              let toolErrorMsg: string | undefined;
              let toolFound: boolean = false;

              for (const tool of this.tools) {
                if (tool.Param.name === toolToUse) {
                  if (this.verbose) {
                    logger.debug({ toolToUse }, "Using tool");
                  }
                  try {
                    toolResult = await tool.Execute(block.input);
                    console_reasoning.toolEnd(toolToUse, true);
                  } catch (err) {
                    toolErrorMsg =
                      err instanceof Error ? err.message : String(err);
                    logger.error(
                      { toolToUse, toolErrorMsg },
                      "Tool execution failed"
                    );
                    console_reasoning.toolEnd(toolToUse, false);
                  }

                  if (this.verbose && !toolErrorMsg) {
                    logger.debug(
                      { toolToUse, resultLength: toolResult?.length },
                      "Tool execution successful"
                    );
                  }
                  toolFound = true;
                  break;
                }
              }

              if (!toolFound) {
                toolErrorMsg = `Tool not found: ${toolToUse}`;
                logger.error({ toolToUse }, "Tool not found");
                console_reasoning.toolEnd(toolToUse, false);
              }

              toolsResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: toolErrorMsg || toolResult,
                is_error: !!toolErrorMsg,
              });
            }
          }

          if (!hasToolUse) {
            // End any active reasoning
            if (this.reasoningState.isActive) {
              console_reasoning.reasoningEnd();
              this.resetReasoningState();
            }
            console_reasoning.finishClaudeTurn();
            break;
          }

          if (this.verbose) {
            logger.debug(
              { toolResultCount: toolsResults.length },
              "Sending tool results to Claude"
            );
          }

          conversation.push({ role: "user", content: toolsResults });
          stream = await this.runInference(conversation);

          stream.on("streamEvent", (event) => {
            this.handleStreamEvent(event);
          });

          message = await stream.finalMessage();
          conversation.push({ role: "assistant", content: message.content });
        }
      } catch (err) {
        if (this.verbose) {
          logger.debug({ err }, "Error during inference");
        }
        console_reasoning.error(
          err instanceof Error ? err.message : String(err)
        );
        return;
      }
    }

    if (this.verbose) {
      logger.debug("Conversation ended");
    }
  }

  private handleStreamEvent(event: Anthropic.MessageStreamEvent) {
    switch (event.type) {
      case "content_block_start":
        switch (event.content_block.type) {
          case "thinking":
            // Start reasoning block
            if (this.enableThinking && !this.reasoningState.isActive) {
              this.reasoningState.isActive = true;
              this.reasoningState.accumulatedText = "";
              this.reasoningState.currentStage = ReasoningStage.ANALYZING;

              if (!this.collapseReasoning) {
                console_reasoning.reasoningStart(
                  this.reasoningState.currentStage,
                  false
                );
              }
            }
            break;
          case "tool_use":
            // Show tool being called
            console_reasoning.toolStart(event.content_block.name);
            break;
        }
        break;

      case "content_block_delta":
        switch (event.delta.type) {
          case "thinking_delta":
            // Stream thinking content
            if (this.enableThinking && this.reasoningState.isActive) {
              const text = event.delta.thinking;
              this.reasoningState.accumulatedText += text;

              // Detect stage changes
              const newStage = detectReasoningStage(
                this.reasoningState.accumulatedText
              );
              if (newStage !== this.reasoningState.currentStage) {
                // Stage changed
                if (!this.collapseReasoning) {
                  console_reasoning.reasoningEnd();
                  console_reasoning.reasoningStart(newStage, false);
                }
                this.reasoningState.currentStage = newStage;
              }

              // Stream the text
              if (!this.collapseReasoning && this.reasoningState.currentStage) {
                console_reasoning.thinkingStream(
                  text,
                  this.reasoningState.currentStage
                );
              }
            }
            break;
          case "text_delta":
            // Stream regular text
            console_reasoning.claudeStream(event.delta.text);
            break;
        }
        break;

      case "content_block_stop":
        // End reasoning block if active
        if (
          this.reasoningState.isActive &&
          event.content_block?.type === "thinking"
        ) {
          if (this.collapseReasoning) {
            // Show collapsed summary
            const summary =
              this.reasoningState.accumulatedText.slice(0, 60) + "...";
            console_reasoning.reasoningCollapsed(summary);
          } else {
            console_reasoning.reasoningEnd();
          }
          this.resetReasoningState();
        }
        break;
    }
  }

  private resetReasoningState() {
    this.reasoningState = {
      isActive: false,
      currentStage: null,
      accumulatedText: "",
      collapsed: this.collapseReasoning,
    };
  }

  private async runInference(conversation: Anthropic.MessageParam[]) {
    const anthropicTools: Anthropic.ToolUnion[] = this.tools.map(
      (tool) => tool.Param
    );

    if (this.verbose) {
      logger.debug(
        "Making API call to Claude with extended thinking:",
        this.enableThinking
      );
    }

    try {
      const params: any = {
        model: "claude-3-7-sonnet-latest",
        max_tokens: 2048,
        messages: conversation,
        tools: anthropicTools,
      };

      // Add extended thinking if enabled
      if (this.enableThinking) {
        params.thinking = {
          type: "enabled",
          budget_tokens: 1024,
        };
      }

      const stream = this.client.messages.stream(params);

      if (this.verbose) {
        logger.debug("API call successful, response received");
      }
      return stream;
    } catch (err) {
      if (this.verbose) {
        logger.debug({ err }, "API call failed");
      }
      throw err;
    }
  }
}
