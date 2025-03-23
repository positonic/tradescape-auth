import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { getTools } from "~/server/tools";
import { createAddVideoTool } from "~/server/tools/addVideoTool";
import { gmTool } from "~/server/tools/gmTool";
import { createVideoSearchTool } from "~/server/tools/videoSearchTool";
import { createActionTools } from "~/server/tools/actionTools";
import { createTraderTools } from "~/server/tools/traderTools";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";
import { createReadStream } from "fs";

interface ToolCallResult {
  result: string | Record<string, unknown>;
  toolName: string;
}

// Define interfaces for each tool's arguments
interface VideoSearchArgs {
  query: string;
  limit?: number;
}

interface VideoArgs {
  videoUrl: string;
  isSearchable?: boolean;
}

interface CreateActionArgs {
  description: string;
  create: true;
  name: string;
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
  priority?: "Quick" | "Scheduled" | "1st Priority" | "2nd Priority" | "3rd Priority" | "4th Priority" | "5th Priority" | "Errand" | "Remember" | "Watch" | "Someday Maybe";
  dueDate?: string;
  projectId?: string;
}

interface ActionIdArgs {
  id: string;
}

interface ActionUpdateArgs extends ActionIdArgs {
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
  description?: string;
  name?: string;
  priority?: "Quick" | "Scheduled" | "1st Priority" | "2nd Priority" | "3rd Priority" | "4th Priority" | "5th Priority" | "Errand" | "Remember" | "Watch" | "Someday Maybe";
  dueDate?: string;
}

interface TranscriptionArgs {
  transcription: string;
}

interface QueryArgs {
  query_type: "date" | "today" | "all";
  date?: string;
  include_completed?: boolean;
}

// Add at the top with other interfaces
interface ToolResponse {
  text?: string;
  result?: string;
  [key: string]: unknown;
}

// Add interface for Lemonfox response
interface LemonfoxResponse {
  text: string;
}

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Your API key here
});

const today = new Date().toISOString().split('T')[0];

export const toolRouter = createTRPCRouter({
  chat: protectedProcedure
    .input(z.object({
      message: z.string(),
      history: z.array(z.object({
        type: z.enum(['system', 'human', 'ai', 'tool']),
        content: z.string(),
        name: z.string().optional(),
        tool_call_id: z.string().optional()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
        try {
            // Fetch user's projects
            const projects = await ctx.db.project.findMany({
              where: { createdById: ctx.session.user.id },
              select: { id: true, name: true }
            });

            // Convert projects to a more structured format
            const projectsJson = JSON.stringify(projects);

            const model = new ChatOpenAI({ 
                modelName: process.env.LLM_MODEL,
                modelKwargs: { "tool_choice": "auto" }
            });

            const systemMessage = new SystemMessage(
                "Tools are equivalent to actions in this system. You have access to the following tools:\n" +
                "- video_search: Search through video transcripts semantically. Use this when asked about video content or to find specific topics in videos.\n" +
                "- retrieve_actions: Retrieves actions from the system. Examples:\n" +
                `  * For today's active tasks: { "query_type": "today" }\n` +
                `  * For all tasks including completed: { "query_type": "today", "include_completed": true }\n` +
                `  * For specific date: { "query_type": "date", "date": "${today}" }\n` +
                `  * For all tasks: { "query_type": "all" }\n` +
                `Available projects: ${projectsJson}\n` +
                // "- create_action: Creates a new action item. MUST include create: true flag. Example:\n" +
                // "  { \"create\": true, \"name\": \"Task name\", \"description\": \"Task description\", \"projectId\": \"project-id\" }\n" +
                // "  If a user mentions a project by name, try to match it to one of the available projects above and pass the projectId to the create_action tool.\n" +
                // "  IMPORTANT: When users mention ANY activities they've already completed (including calls, meetings, exercise, etc.), you MUST ALWAYS create a completed action using create_action with these parameters:\n" +
                // "  - status: \"COMPLETED\"\n" +
                // "  - name: The activity in past tense\n" +
                // "  - description: Details about the activity\n" +
                // "  - dueDate: Today's date (unless a specific date is mentioned)\n" +
                // "  - projectId: For exercise activities, use the exercise project ID \"cm7q7bjf80000zu1r77bdcqdj\"\n" +
                // `  Examples:\n` +
                // `  For "I went for a run for 2.3 hours" use:\n` +
                // `  { \"create\": true, \"name\": \"Completed a 2.3 hour run\", \"description\": \"Went for a run that lasted 2.3 hours\", \"status\": \"COMPLETED\", \"dueDate\": \"${today}\", \"projectId\": \"cm7q7bjf80000zu1r77bdcqdj\"}\n` +
                // `  For "I called my mom for 12 mins" use:\n` +
                // `  { \"create\": true, \"name\": \"Called mom for 12 minutes\", \"description\": \"Had a phone call with mom that lasted 12 minutes\", \"status\": \"COMPLETED\", \"dueDate\": \"${today}\" }\n` +
                // "  Note: Always create the action even if no project is specified. The projectId is optional.\n" +
                "- add_video: Adds a YouTube video to the database. Use this when users want to analyze or process a video.\n" +
               // "- read_action: Retrieves an action's details by ID. Only use this when you have a specific action ID.\n" +
               // "- update_status_action: Updates the status of an existing action. Favoured over create_action for existing actions\n" +
                //"- delete_action: Removes an action from the system.\n" +
                "- market_scan: Use this tool to analyze market setups from a video transcription. Required inputs:\n" +
                "  * transcription: string - The video transcription text to analyze\n" +
                "  Example: { \"transcription\": \"Looking at Bitcoin, the market is showing bullish signals...\" }\n" +
                "- gm: When a user says `gm` we will initiate their morning routing by asking them questions to figure out how to win the morning and the day.\n\n" +
                "IMPORTANT RULES:\n" +
                "1. When users ask what to do or about tasks, use retrieve_actions with query_type='today'. This will show only ACTIVE tasks by default.\n" +
                "2. Only include completed tasks when specifically requested using include_completed=true\n" +
                //"3. To create tasks, you MUST use create_action with create: true\n" +
                "4. Never try to create a task when asked to show or list tasks\n" +
                "5. When asked about today's tasks, use retrieve_actions with query_type='today'\n" +
                "After using a tool, always provide a natural language response explaining the result." +
                "6. market_scan tool should take precedence over create_action tool" +
                "7. When a user mentions a coin, use market_scan tool to get the setup for that coin."
            );
            //console.log('=== System message:', systemMessage.content);
            const tools = getTools(ctx);
            // console.log('=== Available tools:', tools.map(t => ({
            //     name: t.name,
            //     description: t.description,
            //     schema: t.schema
            // })));
            
            const llmWithTools = model.bindTools(tools);

            const messages = [systemMessage, ...input.history.map(msg => {
                switch (msg.type) {
                    case 'system': return new SystemMessage(msg.content);
                    case 'human': return new HumanMessage(msg.content);
                    case 'ai': return new AIMessage(msg.content);
                    case 'tool': return new ToolMessage(msg.content, msg.tool_call_id ?? '');
                }
            })];

            messages.push(new HumanMessage(input.message));

            let response = await llmWithTools.invoke(messages);
            console.log('=== Initial AI response:', {
                content: response.content,
                tool_calls: response.tool_calls
            });
            
            if(!response.tool_calls || response.tool_calls.length === 0) {
                console.log('=== No tool calls made');
                return { response: response.content };
            }
            
            // Handle tool calls
            const toolResults = await Promise.all(response.tool_calls.map(async (toolCall) => {
                if (!toolCall?.args) {
                    console.log('=== Invalid tool call:', toolCall);
                    return null;
                }
                
                console.log('=== Processing tool call:', {
                    name: toolCall.name,
                    args: JSON.stringify(toolCall.args, null, 2)
                });
                
                //const actionTools = createActionTools(ctx);
                const traderTools = createTraderTools(ctx);
                let toolResult: ToolResponse;
                
                try {
                    console.log('********* toolCall is ', toolCall);
                    switch(toolCall.name) {
                        case "video_search":
                            toolResult = await createVideoSearchTool(ctx).invoke(toolCall.args as VideoSearchArgs) as ToolResponse;
                            break;
                        case "add_video":
                            toolResult = await createAddVideoTool(ctx).invoke(toolCall.args as VideoArgs) as ToolResponse;
                            break;
                        // case "create_action":
                        //     toolResult = await actionTools.createActionTool.invoke(toolCall.args as CreateActionArgs) as ToolResponse;
                        //     break;
                        // case "read_action":
                        //     toolResult = await actionTools.readActionTool.invoke(toolCall.args as ActionIdArgs) as ToolResponse;
                        //     break;
                        // case "update_status_action":
                        //     toolResult = await actionTools.updateActionTool.invoke(toolCall.args as ActionUpdateArgs) as ToolResponse;
                        //     break;
                        // case "delete_action":
                        //     toolResult = await actionTools.deleteActionTool.invoke(toolCall.args as ActionIdArgs) as ToolResponse;
                        //     break;
                        case "market_scan":
                            toolResult = await traderTools.marketScanTool.invoke(toolCall.args as TranscriptionArgs) as ToolResponse;
                            break;
                        // case "create_timeline":
                        //     toolResult = await traderTools.timelineTool.invoke(toolCall.args as any);
                        //     break;
                        // case "retrieve_actions":
                        //     toolResult = await actionTools.retrieveActionsTool.invoke(toolCall.args as QueryArgs) as ToolResponse;
                        //     break;
                        case "gm":
                            toolResult = await gmTool().invoke(toolCall.args as VideoArgs) as ToolResponse;
                            break;
                        default:
                            throw new Error(`Unknown tool: ${toolCall.name}`);
                    }
                    
                    if(toolCall.name === "market_scan") {
                        try {
                            const resultText = toolResult.result ?? toolResult.text ?? '';
                            if (resultText) {
                                console.log("toolResult JSON is ", JSON.parse(resultText));
                            } else {
                                console.warn("Empty market scan result");
                            }
                        } catch (parseError) {
                            console.error("Failed to parse market scan result:", parseError);
                        }
                    }
                    // Add tool result to messages
                    messages.push(new AIMessage({ content: "", tool_calls: [toolCall] }));
                    messages.push(new ToolMessage(String(toolResult.result ?? toolResult.text ?? ''), toolCall.id ?? ''));
                    
                    return { result: toolResult, toolName: toolCall.name };
                } catch (error) {
                    console.error('=== Tool execution error:', {
                        tool: toolCall.name,
                        args: toolCall.args,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    throw error;
                }
            }));
            
            // Filter out null results and get final response
            const validToolResults: ToolCallResult[] = toolResults.filter(Boolean) as ToolCallResult[];
            console.log('=== toolResults:', toolResults);
            if (validToolResults.length > 0) {
                response = await llmWithTools.invoke(messages);
            }
            // console.log('=== Final AI response:', {
            //     content: response.content,
            //     tool_calls: response.tool_calls,
            //     validToolResults: validToolResults.map(result => JSON.parse(validToolResults?.[0]?.result ?? '{}'))
            // });
            return { response: response.content, validToolResults };
        } catch (error) {
            console.error('Error:', error);
            throw new Error(`AI chat error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }),
    transcribe: protectedProcedure
    .input(z.object({ audio: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const tmpFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.mp3`);
        await fs.promises.writeFile(tmpFilePath, Buffer.from(input.audio, "base64"));

        const transcription = await openai.audio.transcriptions.create({
          file: createReadStream(tmpFilePath),
          model: "whisper-1",
          response_format: "text"
        });

        // Clean up the temporary file
        await fs.promises.unlink(tmpFilePath);
        
        return { text: String(transcription) };
      } catch (error) {
        console.error('Error during transcription:', error);
        throw error;
      }
    }),
    transcribeFox: protectedProcedure
    .input(z.object({ audio: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const formData = new FormData();
        // Convert base64 to blob directly
        const base64Data = input.audio;
        const binaryData = Buffer.from(base64Data, 'base64');
        const audioBlob = new Blob([binaryData], { type: 'audio/webm' });
        
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('language', 'english');
        formData.append('response_format', 'json');

        const response = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.LEMONFOX_API_KEY}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Lemonfox API error: ${response.statusText}`);
        }

        const data = await response.json() as LemonfoxResponse;
        return { text: data.text };
      } catch (error) {
        console.error('Error during Lemonfox transcription:', error);
        throw error;
      }
    }),
}); 