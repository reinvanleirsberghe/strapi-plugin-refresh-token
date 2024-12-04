import jwt from 'jsonwebtoken';
import { PLUGIN_ID } from '../pluginId';

interface JwtPayload {
  userId : number,
  secret: string,
}

function auth({ strapi }) {
  const config = strapi.config.get(`plugin::${PLUGIN_ID}`);

  return async (ctx, next) => {
    await next();
    if (ctx.request.method === 'POST' && ctx.request.path === '/api/auth/local') {
      const requestRefresh = ctx.request.body?.requestRefresh || config.requestRefreshOnAll;
      if (ctx.response.body && ctx.response.message==='OK' && requestRefresh) {
       
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
        ctx.response.body = {
          ...ctx.response.body,
          refreshToken: refreshToken,
        };
      }
    } else if (ctx.request.method === 'POST' && ctx.request.path === '/api/auth/local/refresh') {
      const refreshToken = ctx.request.body?.refreshToken;
      if (refreshToken) {
        try {
          const decoded = await jwt.verify(refreshToken, config.refreshTokenSecret) as JwtPayload;
          console.log('Token successfully verified:', decoded);
          if (decoded) {
            const data = await strapi
              .query('plugin::refresh-token.token')
              .findOne({
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