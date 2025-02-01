import jwt from 'jsonwebtoken';
import { PLUGIN_ID } from '../pluginId';

interface JwtPayload {
  userId: number;
  secret: string;
}
function calculateMaxAge(param) {
  const unit = param.slice(-1); // Get the unit (d, h, m)
  const value = parseInt(param.slice(0, -1)); // Get the numerical value

  let maxAge;

  switch (unit) {
    case 'd':
      maxAge = 1000 * 60 * 60 * 24 * value;
      break;
    case 'h':
      maxAge = 1000 * 60 * 60 * value;
      break;
    case 'm':
      maxAge = 1000 * 60 * value;
      break;
    default:
      throw new Error('Invalid tokenExpires format. Use formats like "30d", "1h", "15m".');
  }

  return maxAge;
}
function auth({ strapi }) {
  const config = strapi.config.get(`plugin::${PLUGIN_ID}`);

  return async (ctx, next) => {
    await next();
    if (ctx.request.method === 'POST' && ctx.request.path === '/api/auth/local') {
      const requestRefresh = ctx.request.body?.requestRefresh || config.requestRefreshOnAll;
      if (ctx.response.body && ctx.response.message === 'OK' && requestRefresh) {
        const refreshEntry = await strapi
          .plugin(PLUGIN_ID)
          .service('service')
          .create(ctx.response.body?.user, ctx);
        const refreshToken = jwt.sign(
          { userId: ctx.response.body?.user?.id, secret: refreshEntry.documentId },
          config.refreshTokenSecret,
          {
            expiresIn: config.refreshTokenExpiresIn,
          }
        );
        if (config.cookieResponse) {
          ctx.cookies.set('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' ? true : false,
            maxAge: calculateMaxAge(config.refreshTokenExpiresIn),
            domain:
              process.env.NODE_ENV === 'development' ? 'localhost' : process.env.PRODUCTION_URL,
          });
        } else {
          ctx.response.body = {
            ...ctx.response.body,
            refreshToken: refreshToken,
          };
        }
      }
    } else if (
      ctx.request.method === 'GET' &&
      (ctx.request.path.includes('/api/auth/google/callback') ||
        ctx.request.path.includes('/api/auth/facebook/callback') ||
        ctx.request.path.includes('/api/auth/apple/callback'))
    ) {
      const requestRefresh = true;
      if (ctx.response.body && ctx.response.message === 'OK' && requestRefresh) {
        const refreshEntry = await strapi
          .plugin(PLUGIN_ID)
          .service('service')
          .create(ctx.response.body?.user, ctx);
        const refreshToken = jwt.sign(
          { userId: ctx.response.body?.user?.id, secret: refreshEntry.documentId },
          config.refreshTokenSecret,
          {
            expiresIn: config.refreshTokenExpiresIn,
          }
        );
        if (config.cookieResponse) {
          ctx.cookies.set('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' ? true : false,
            maxAge: calculateMaxAge(config.refreshTokenExpiresIn),
            domain:
              process.env.NODE_ENV === 'development' ? 'localhost' : process.env.PRODUCTION_URL,
          });
        } else {
          ctx.response.body = {
            ...ctx.response.body,
            refreshToken: refreshToken,
          };
        }
      }
    } else if (ctx.request.method === 'POST' && ctx.request.path === '/api/auth/local/refresh') {
      const refreshToken = ctx.request.body?.refreshToken;
      if (refreshToken) {
        try {
          const decoded = (await jwt.verify(refreshToken, config.refreshTokenSecret)) as JwtPayload;
          if (decoded) {
            const data = await strapi.query('plugin::refresh-token.token').findOne({
              where: { documentId: decoded.secret },
            });

            if (data) {
              ctx.send({
                jwt: strapi
                  .plugin('users-permissions')
                  .service('jwt')
                  .issue({ id: decoded.userId }),
              });
            } else {
              ctx.status = 401;
              ctx.response.body = { error: 'Invalid Token' };
            }
          }
        } catch (err) {
          ctx.status = 401;
          ctx.response.body = { error: 'Invalid Token' };
        }
      }
    }
  };
}
export default auth;
