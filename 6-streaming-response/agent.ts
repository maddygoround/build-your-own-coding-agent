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
      logger.debug("Conversation started");
    }

    console_out.banner("Chat with Claude (use 'ctrl-c' to quit)");

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
          switch (event.type) {
            case "content_block_start":
              switch (event.content_block.type) {
                case "tool_use":
                  console_out.toolStart(event.content_block.name);
                  break;
              }
              break;
            case "content_block_delta":
              switch (event.delta.type) {
                case "text_delta":
                  console_out.claudeStream(event.delta.text);
                  break;
              }
              break;
          }
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
            switch (event.type) {
              case "content_block_start":
                switch (event.content_block.type) {
                  case "tool_use":
                    console_out.toolStart(event.content_block.name);
                    break;
                }
                break;
              case "content_block_delta":
                switch (event.delta.type) {
                  case "text_delta":
                    console_out.claudeStream(event.delta.text);
                    break;
                }
                break;
            }
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

  private async runInference(conversation: Anthropic.MessageParam[]) {
    const anthropicTools: Anthropic.ToolUnion[] = this.tools.map(
      (tool) => tool.Param
    );

    if (this.verbose) {
      logger.debug("Making API call to Claude");
    }

    try {
      const stream = this.client.messages.stream({
        model: "claude-3-5-haiku-latest",
        max_tokens: 1024,
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
