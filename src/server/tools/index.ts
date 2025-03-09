import { adderTool } from './adderTool';
import { createVideoSearchTool } from './videoSearchTool';
import { createAddVideoTool } from './addVideoTool';
import { gmTool } from './gmTool';
import { createActionTools } from "~/server/tools/actionTools";
import { createTraderTools } from "~/server/tools/traderTools";
import type { Context } from "~/server/auth/types";

export const getTools = (ctx: Context) => {
  const actionTools = createActionTools(ctx);
  const traderTools = createTraderTools(ctx);
  return [
    adderTool,
    gmTool(),
    createVideoSearchTool(ctx),
    createAddVideoTool(ctx),
    actionTools.createActionTool,
    actionTools.readActionTool,
    actionTools.updateActionTool,
    actionTools.deleteActionTool,
    actionTools.retrieveActionsTool,
    traderTools.marketScanTool
  ]
}