/**
 * Metro — `.glb` (3D загвар)-ыг ассет гэж танина.
 *
 * `assets/ger/ger-realtime.glb` нь tools/blender/ger_realtime.py-ээс гарна.
 * Expo-ийн анхдагч тохиргоо monorepo-г (watchFolders, nodeModulesPaths)
 * өөрөө тохируулдаг тул зөвхөн ассетийн өргөтгөл нэмнэ.
 */
const { getDefaultConfig } = require('expo/metro-config');
const http = require('node:http');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...config.resolver.assetExts, 'glb'];

// A phone can reach Metro on port 8081 even when Windows blocks the API's
// separate 3001 port. Forward API requests through Metro to the local Next app.
const previousEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (metroMiddleware, metroServer) => {
  const nextMiddleware = previousEnhanceMiddleware
    ? previousEnhanceMiddleware(metroMiddleware, metroServer)
    : metroMiddleware;

  return (req, res, next) => {
    const requestPath = req.url ?? '/';
    if (
      requestPath !== '/api' &&
      !requestPath.startsWith('/api/') &&
      !requestPath.startsWith('/api?')
    ) {
      return nextMiddleware(req, res, next);
    }

    const headers = { ...req.headers, host: 'localhost:3001' };
    for (const header of [
      'connection',
      'keep-alive',
      'proxy-connection',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
    ]) {
      delete headers[header];
    }

    const apiRequest = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path: requestPath,
        method: req.method,
        headers,
      },
      (apiResponse) => {
        res.writeHead(apiResponse.statusCode ?? 502, apiResponse.headers);
        apiResponse.pipe(res);
      }
    );

    apiRequest.on('error', (error) => {
      console.error(`[metro api proxy] ${error.message}`);
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: {
            code: 'API_UNAVAILABLE',
            message: 'Local API is unavailable',
            retryable: true,
          },
        })
      );
    });

    req.on('aborted', () => apiRequest.destroy());
    req.pipe(apiRequest);
  };
};

module.exports = config;
