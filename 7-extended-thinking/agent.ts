import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline/promises";
import { console_out } from "../console";
import { logger } from "../logger";
import { ToolDefinition } from "./types";

export class Agent {
  private client: Anthropic;
  private rl: readline.Interface;
  private verbose: boolean;
  private tools: ToolDefinition[];
  private isThinking: boolean = false;

  constructor(
    client: Anthropic,
    rl: readline.Interface,
    tools: ToolDefinition[],
    verbose?: boolean
  ) {
    this.client = client;
    this.rl = rl;
    this.tools = tools;
    this.verbose = !!verbose;
  }

  async run() {
    const conversation: Anthropic.MessageParam[] = [];

    if (this.verbose) {
      logger.debug("Conversation started with extended thinking");
    }

    console_out.banner(
      "Chat with Claude (Extended Thinking) - use 'ctrl-c' to quit"
    );

    while (true) {
      let userInput: string;
      try {
        userInput = await this.rl.question(console_out.userPromptString());
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
                  console_out.toolStart(toolToUse, block.input);
                  try {
                    toolResult = await tool.Execute(block.input);
                    console_out.toolEnd(toolToUse, true);
                  } catch (err) {
                    toolErrorMsg =
                      err instanceof Error ? err.message : String(err);
                    logger.error(
                      { toolToUse, toolErrorMsg },
                      "Tool execution failed"
                    );
                    console_out.toolEnd(toolToUse, false);
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
                console_out.toolEnd(toolToUse, false);
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
            console_out.finishClaudeTurn();
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
        console_out.error(err instanceof Error ? err.message : String(err));
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
        if (event.content_block.type === "thinking") {
          this.isThinking = true;
          console_out.thinkingStart();
        } else if (event.content_block.type === "tool_use") {
          // Tool start is displayed during execution to show parameters
        }
        break;

      case "content_block_delta":
        if (event.delta.type === "thinking_delta") {
          console_out.thinkingStream(event.delta.thinking);
        } else if (event.delta.type === "text_delta") {
          console_out.claudeStream(event.delta.text);
        }
        break;

      case "content_block_stop":
        if (this.isThinking) {
          console_out.thinkingEnd();
          this.isThinking = false;
        }
        break;
    }
  }

  private async runInference(conversation: Anthropic.MessageParam[]) {
    const anthropicTools: Anthropic.ToolUnion[] = this.tools.map(
      (tool) => tool.Param
    );

    if (this.verbose) {
      logger.debug("Making API call to Claude with extended thinking");
    }

    try {
      const stream = this.client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        thinking: {
          type: "enabled",
          budget_tokens: 10000,
        },
        messages: conversation,
        tools: anthropicTools,
      });

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
