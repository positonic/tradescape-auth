import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, AIMessage, HumanMessage, ToolMessage, BaseMessageLike } from "@langchain/core/messages";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
// import asana from 'asana';
// import { Tool } from "langchain/tools";

// Initialize Asana client
// const configuration = new asana.Client.create({
//   defaultHeaders: { 'Asana-Enable': 'new_project_templates,new_user_task_lists' },
//   logAsanaChangeWarnings: false,
// }).useAccessToken(env.ASANA_ACCESS_TOKEN);

// Create tool functions
// const createAsanaTaskTool = new Tool({
//   name: "create_asana_task",
//   description: "Creates a task in Asana given the name of the task and when it is due",
//   func: async ({ task_name, project_gid, due_on = new Date().toISOString().split('T')[0] }) => {
//     try {
//       const result = await configuration.tasks.create({
//         name: task_name,
//         due_on: due_on,
//         projects: [project_gid]
//       });
//       return JSON.stringify(result, null, 2);
//     } catch (e) {
//       return `Error creating task: ${e.message}`;
//     }
//   }
// });

export const asanaRouter = createTRPCRouter({
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
    .mutation(async ({ input }) => {
        console.log('muation input is ', input);
    //   const model = process.env.LLM_MODEL?.toLowerCase().includes('gpt') 
    //     ? new ChatOpenAI({ modelName: process.env.LLM_MODEL })
    //     : new ChatAnthropic({ modelName: process.env.LLM_MODEL });
    const model = new ChatOpenAI({ modelName: process.env.LLM_MODEL });

      // const tools = [createAsanaTaskTool /* add other tools */];
      // const chainWithTools = model.bind({ tools });

      // Convert history to LangChain message format
      const messages = input.history.map(msg => {
        switch (msg.type) {
          case 'system': return new SystemMessage(msg.content);
          case 'human': return new HumanMessage(msg.content);
          case 'ai': return new AIMessage(msg.content);
          case 'tool': return new ToolMessage(msg.content, msg.tool_call_id ?? '');
        }
      });
    // const messages = input.history.map(msg => {
    //     return {
    //         role: msg.type,
    //         content: msg.content
    //     } as BaseMessageLike;
    // });
      // Add the new user message
      messages.push(new HumanMessage(input.message));

      try {
        const response = await model.invoke(messages);
        console.log('response is ', response);
        return { response: response.content };
      } catch (error) {
        throw new Error(`AI chat error: ${error.message}`);
      }
    })
}); 