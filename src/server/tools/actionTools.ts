import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { PRIORITY_VALUES } from "~/types/priority";
import type { Context } from "~/server/auth/types";
import type { Action } from "@prisma/client";

// Schemas for the Action CRUD operations
const createActionSchema = z.object({
  create: z.literal(true),
  name: z.string(),
  description: z.string(),
  dueDate: z.string().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
  priority: z.enum(PRIORITY_VALUES).default("Quick"),
  projectId: z.string().optional(),
});

const readActionSchema = z.object({
  id: z.string(),
});

const updateActionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
});

const deleteActionSchema = z.object({
  id: z.string(),
});

const retrieveActionsSchema = z.object({
  query_type: z.enum(['today', 'date', 'all']),
  date: z.string().optional(),
  include_completed: z.boolean().optional().default(false),
});

interface WhereClause {
  createdById: string;
  status?: string;
  dueDate?: {
    gte: Date;
    lte: Date;
  };
}

export const createActionTools = (ctx: Context) => {
  const createActionTool = tool(
    async (input: z.infer<typeof createActionSchema>): Promise<string> => {
      try {
        if (!input) {
          throw new Error("Input is required");
        }

        if (!ctx.session?.user?.id) {
          throw new Error("User not authenticated");
        }

        console.log('input is ', input);
        
        const action = await ctx.db.action.create({
          data: {
            name: input.name,
            description: input.description,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            status: input.status,
            priority: input.priority,
            createdById: ctx.session.user.id,
            projectId: input.projectId,
          },
        });
        
        console.log('create action is ', action);
        return `Successfully created action "${action.name}" with ID: ${action.id}`;
      } catch (error) {
        console.error('Error creating action:', {
          error: error instanceof Error ? error.message : String(error),
          input
        });
        
        if (error instanceof Error && error.message.includes('foreign key')) {
          return `Created action "${input?.name ?? 'unknown'}" without a project association`;
        }
        throw new Error(`Failed to create action: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    {
      name: "create_action",
      description: "Creates a new action item. MUST include create: true in the input. Example: { create: true, name: 'Task name', description: 'Task description' }",
      schema: createActionSchema
    }
  );

  const readActionTool = tool(
    async (input: z.infer<typeof readActionSchema>): Promise<string> => {
      try {
        const action = await ctx.db.action.findUnique({
          where: { id: input.id },
        });
        if (!action) {
          throw new Error("Action not found");
        }
        return JSON.stringify(action, null, 2);
      } catch (error) {
        console.error('Error reading action:', error);
        throw new Error(`Failed to read action: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    {
      name: "read_action",
      description: "Retrieves an action by its ID",
      schema: readActionSchema,
    }
  );

  const updateActionTool = tool(
    async (input: z.infer<typeof updateActionSchema>): Promise<string> => {
      try {
        console.log('Update status action input is ', input);
        const action = await ctx.db.action.update({
          where: { id: input.id },
          data: {
            ...(input.status && { status: input.status }),
            ...(input.name && { name: input.name }),
            ...(input.description && { description: input.description }),
            ...(input.dueDate && { dueDate: new Date(input.dueDate) }),
            ...(input.priority && { priority: input.priority }),
          },
        });
        return `Successfully updated action "${action.name}"`;
      } catch (error) {
        console.error('Error updating action:', error);
        throw new Error(`Failed to update action: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    {
      name: "update_status_action",
      description: "Updates an existing action by ID with optional new values",
      schema: updateActionSchema,
    }
  );

  const deleteActionTool = tool(
    async (input: z.infer<typeof deleteActionSchema>): Promise<string> => {
      try {
        await ctx.db.action.delete({
          where: { id: input.id },
        });
        return `Successfully deleted action with ID: ${input.id}`;
      } catch (error) {
        console.error('Error deleting action:', error);
        throw new Error(`Failed to delete action: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    {
      name: "delete_action",
      description: "Deletes an action by its ID",
      schema: deleteActionSchema,
    }
  );

  const retrieveActionsTool = tool(
    async (input: z.infer<typeof retrieveActionsSchema>): Promise<string> => {
      try {
        if (!ctx.session?.user?.id) {
          throw new Error("User not authenticated");
        }

        const where: WhereClause = { 
          createdById: ctx.session.user.id,
          ...(input.include_completed ? {} : { status: 'ACTIVE' })
        };
        
        if (input.query_type === 'today') {
          const today = new Date();
          where.dueDate = {
            gte: new Date(today.setHours(0, 0, 0, 0)),
            lte: new Date(today.setHours(23, 59, 59, 999))
          };
        } else if (input.query_type === 'date' && input.date) {
          const targetDate = new Date(input.date);
          where.dueDate = {
            gte: new Date(targetDate.setHours(0, 0, 0, 0)),
            lte: new Date(targetDate.setHours(23, 59, 59, 999))
          };
        }

        console.log('Retrieve actions where clause:', where);

        const actions = await ctx.db.action.findMany({
          where,
          orderBy: [
            { priority: 'desc' },
            { dueDate: 'asc' }
          ]
        });
        
        return JSON.stringify(actions, null, 2);
      } catch (error) {
        console.error('Error retrieving actions:', error);
        throw new Error(`Failed to retrieve actions: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    {
      name: "retrieve_actions",
      description: "Retrieves actions from the system. Use query_type='today' for today's tasks, 'date' with a specific date, or 'all' for all tasks.",
      schema: retrieveActionsSchema
    }
  );

  return {
    createActionTool,
    readActionTool,
    updateActionTool,
    deleteActionTool,
    retrieveActionsTool,
  };
}; 