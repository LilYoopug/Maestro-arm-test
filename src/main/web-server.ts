import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { FastifyInstance } from 'fastify';

/**
 * WebServer - HTTP and WebSocket server for remote access
 *
 * STATUS: Partial implementation (Phase 6 - Remote Access & Tunneling)
 *
 * Current functionality:
 * - Health check endpoint (/health) - WORKING
 * - WebSocket echo endpoint (/ws) - PLACEHOLDER (echoes messages for connectivity testing)
 * - Session list endpoint (/api/sessions) - PLACEHOLDER (returns empty array)
 * - Session detail endpoint (/api/sessions/:id) - PLACEHOLDER (returns stub data)
 *
 * Phase 6 implementation plan:
 * - Integrate with ProcessManager to expose real session data
 * - Implement real-time session state broadcasting via WebSocket
 * - Stream process output to connected clients
 * - Handle input commands from remote clients
 * - Add authentication and authorization
 * - Support mobile/tablet responsive UI
 * - Integrate with ngrok tunneling for public access
 *
 * See PRD.md Phase 6 for full requirements.
 */
export class WebServer {
  private server: FastifyInstance;
  private port: number;
  private isRunning: boolean = false;

  constructor(port: number = 8000) {
    this.port = port;
    this.server = Fastify({
      logger: {
        level: 'info',
      },
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  private async setupMiddleware() {
    // Enable CORS for web access
    await this.server.register(cors, {
      origin: true,
    });

    // Enable WebSocket support
    await this.server.register(websocket);
  }

  private setupRoutes() {
    // Health check
    this.server.get('/health', async () => {
      return { status: 'ok', timestamp: Date.now() };
    });

    // WebSocket endpoint for real-time updates
    // NOTE: This is a placeholder implementation for Phase 6 (Remote Access & Tunneling)
    // Current behavior: Echoes messages back to test connectivity
    // Future implementation (Phase 6):
    // - Broadcast session state changes to all connected clients
    // - Stream process output in real-time
    // - Handle input commands from remote clients
    // - Implement authentication and authorization
    // - Support multiple simultaneous connections
    this.server.get('/ws', { websocket: true }, (connection) => {
      connection.socket.on('message', (message) => {
        // PLACEHOLDER: Echo back for testing connectivity only
        connection.socket.send(JSON.stringify({
          type: 'echo',
          data: message.toString(),
        }));
      });

      connection.socket.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Maestro WebSocket',
      }));
    });

    // Session list endpoint
    // NOTE: Placeholder for Phase 6. Currently returns empty array.
    // Future: Return actual session list from ProcessManager
    this.server.get('/api/sessions', async () => {
      return {
        sessions: [],
        timestamp: Date.now(),
      };
    });

    // Session detail endpoint
    // NOTE: Placeholder for Phase 6. Currently returns stub data.
    // Future: Return actual session details including state, output, etc.
    this.server.get('/api/sessions/:id', async (request) => {
      const { id } = request.params as { id: string };
      return {
        sessionId: id,
        status: 'idle',
      };
    });

    // Setup web interface routes under /web/* namespace
    this.setupWebInterfaceRoutes();
  }

  /**
   * Setup routes for the web interface under /web/* namespace
   *
   * This namespace is dedicated to the new web interface that provides:
   * - Desktop Web: Full-featured collaborative interface for hackathons/team coding
   * - Mobile Web: Lightweight remote control for sending commands from phone
   *
   * Future routes planned:
   * - /web/desktop - Desktop web interface entry point
   * - /web/mobile - Mobile web interface entry point
   * - /web/api/* - REST API endpoints for web clients
   * - /ws/web - WebSocket endpoint for real-time updates to web clients
   */
  private setupWebInterfaceRoutes() {
    // Web interface root - returns info about available interfaces
    this.server.get('/web', async () => {
      return {
        name: 'Maestro Web Interface',
        version: '1.0.0',
        interfaces: {
          desktop: '/web/desktop',
          mobile: '/web/mobile',
        },
        api: '/web/api',
        websocket: '/ws/web',
        timestamp: Date.now(),
      };
    });

    // Desktop web interface entry point (placeholder)
    this.server.get('/web/desktop', async () => {
      return {
        message: 'Desktop web interface - Coming soon',
        description: 'Full-featured collaborative interface for hackathons/team coding',
      };
    });

    // Desktop web interface with wildcard for client-side routing
    this.server.get('/web/desktop/*', async () => {
      return {
        message: 'Desktop web interface - Coming soon',
        description: 'Full-featured collaborative interface for hackathons/team coding',
      };
    });

    // Mobile web interface entry point (placeholder)
    this.server.get('/web/mobile', async () => {
      return {
        message: 'Mobile web interface - Coming soon',
        description: 'Lightweight remote control for sending commands from your phone',
      };
    });

    // Mobile web interface with wildcard for client-side routing
    this.server.get('/web/mobile/*', async () => {
      return {
        message: 'Mobile web interface - Coming soon',
        description: 'Lightweight remote control for sending commands from your phone',
      };
    });

    // Web API namespace root
    this.server.get('/web/api', async () => {
      return {
        name: 'Maestro Web API',
        version: '1.0.0',
        endpoints: {
          sessions: '/web/api/sessions',
          theme: '/web/api/theme',
        },
        timestamp: Date.now(),
      };
    });
  }

  async start() {
    if (this.isRunning) {
      console.log('Web server already running');
      return;
    }

    try {
      await this.server.listen({ port: this.port, host: '0.0.0.0' });
      this.isRunning = true;
      console.log(`Maestro web server running on http://localhost:${this.port}`);
    } catch (error) {
      console.error('Failed to start web server:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.server.close();
      this.isRunning = false;
      console.log('Web server stopped');
    } catch (error) {
      console.error('Failed to stop web server:', error);
    }
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  getServer(): FastifyInstance {
    return this.server;
  }
}
