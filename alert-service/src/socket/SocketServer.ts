import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { config } from "../config.js";

export function createSocketServer(): {
  httpServer: ReturnType<typeof createServer>;
  io: SocketIOServer;
} {
  const httpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
      );
      return;
    }

    // Default response
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Alert Service Running");
  });

  // Parse CORS origins - support comma-separated list
  const allowedOrigins = config.corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins.length > 1 ? allowedOrigins : config.corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
  });

  // Alerts namespace - matches the client in socketService.ts
  const alertsNamespace = io.of("/alerts");

  alertsNamespace.on("connection", (socket) => {
    const userId = socket.handshake.query.userId as string | undefined;

    if (!userId) {
      console.log("[Socket] Connection rejected: no userId");
      socket.disconnect();
      return;
    }

    // Join user to their personal room
    socket.join(`user:${userId}`);
    console.log(`[Socket] User ${userId} connected (socket: ${socket.id})`);

    // Handle test event
    socket.on("test", (data) => {
      console.log(`[Socket] Test from user ${userId}:`, data);
      socket.emit("test", { received: data, echo: true });
    });

    // Handle ready for notifications event
    socket.on("ready_for_notifications", () => {
      console.log(`[Socket] User ${userId} ready for notifications`);
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`[Socket] User ${userId} disconnected: ${reason}`);
    });
  });

  // Log namespace connections
  io.on("connection", (socket) => {
    console.log(`[Socket] Main namespace connection: ${socket.id}`);
  });

  return { httpServer, io };
}

export function startSocketServer(
  httpServer: ReturnType<typeof createServer>,
  port: number,
): Promise<void> {
  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      console.log(`[Socket] Server listening on port ${port}`);

      // Parse and display allowed origins
      const allowedOrigins = config.corsOrigin
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

      if (allowedOrigins.length > 1) {
        console.log(`[Socket] CORS allowed origins (${allowedOrigins.length}):`);
        allowedOrigins.forEach((origin, index) => {
          console.log(`  ${index + 1}. ${origin}`);
        });
      } else {
        console.log(`[Socket] CORS origin: ${config.corsOrigin}`);
      }

      resolve();
    });
  });
}
