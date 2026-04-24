import { FastifyRequest, FastifyReply } from 'fastify'

type Plan = 'FREE' | 'PRO' | 'AGENCY'

export function planGuard(allowedPlans: Plan[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const plan = request.userPlan as Plan
    if (!allowedPlans.includes(plan)) {
      return reply.status(403).send({
        error: 'PLAN_REQUIRED',
        requiredPlan: allowedPlans,
        currentPlan: plan,
      })
    }
  }
}
