import type { Core } from '@strapi/strapi';
import { subDays, subHours, subMinutes } from 'date-fns';
import { PLUGIN_ID } from '../pluginId';



export function calculateExpirationThreshold(tokenExpires) {
  const unit = tokenExpires.slice(-1); // Get the unit (d, h, m)
  const value = parseInt(tokenExpires.slice(0, -1)); // Get the numerical value

  let expirationThreshold = new Date();

  switch (unit) {
    case 'd':
      expirationThreshold = subDays(expirationThreshold, value);
      break;
    case 'h':
      expirationThreshold = subHours(expirationThreshold, value);
      break;
    case 'm':
      expirationThreshold = subMinutes(expirationThreshold, value);
      break;
    default:
      throw new Error('Invalid tokenExpires format. Use formats like "30d", "1h", "15m".');
  }

  return expirationThreshold;
}

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  async cleanExpiredTokens(user) {
    const { refreshTokenExpiresIn } = strapi.config.get(`plugin::${PLUGIN_ID}`) as { refreshTokenExpiresIn:String };
    const expirationThreshold = calculateExpirationThreshold(refreshTokenExpiresIn);
    const response = await strapi.query('plugin::refresh-token.token').findMany({
      filters: {
        user: user.id,
        createdAt: { $lt: expirationThreshold.toISOString() },
      },
    });
    for (const token of response) {
      await strapi.query('plugin::refresh-token.token').delete({
        where: { id: token.id },
      });
      // console.log(`Deleted token with id: ${token.id}`);
    }
  },
  async create(user, request) {
    this.cleanExpiredTokens(user);
    const response = await strapi.query('plugin::refresh-token.token').create({
      data: {
        user: user.id,
        ipAddress: request.ip,
      },
    });
    return response;
  },
});

export default service;
