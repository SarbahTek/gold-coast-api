import {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
} from 'fastify'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'

import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { swaggerSchemas } from '../../config/swagger'

interface PaystackEventData {
  reference: string
  amount: number
  currency: string
  status: string
  metadata?: Record<string, unknown>
}

interface PaystackEvent {
  event: string
  data: PaystackEventData
}

interface RawBodyRequest extends FastifyRequest {
  rawBody?: string
}

function verifyPaystackSignature(
  payload: string,
  signature: string
): boolean {
  const hash = crypto
    .createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  // Prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  )
}

async function handleWebhook(
  req: RawBodyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = req.headers[
    'x-paystack-signature'
  ] as string | undefined

  if (!signature) {
    reply.status(401).send({
      error: 'Missing signature',
    })
    return
  }

  // IMPORTANT:
  // Use rawBody for signature verification.
  // JSON.stringify(req.body) can reorder keys and break verification.
  const rawBody =
    req.rawBody ?? JSON.stringify(req.body ?? {})

  if (!verifyPaystackSignature(rawBody, signature)) {
    reply.status(401).send({
      error: 'Invalid signature',
    })
    return
  }

  const event = req.body as PaystackEvent

  if (event.event === 'charge.success') {
    const { reference, status } = event.data

    const isPaid = status === 'success'

    const transaction =
      await prisma.paymentTransaction.findFirst({
        where: {
          providerRef: reference,
        },
        select: {
          id: true,
          orderId: true,
        },
      })

    if (transaction) {
      await prisma.$transaction([
        prisma.paymentTransaction.update({
          where: {
            id: transaction.id,
          },
          data: {
            status: isPaid ? 'paid' : 'failed',

            // FIXED:
            // Prisma expects InputJsonValue
            webhookPayload:
              event as unknown as Prisma.InputJsonValue,
          },
        }),

        ...(isPaid
          ? [
              prisma.order.update({
                where: {
                  id: transaction.orderId,
                },
                data: {
                  status: 'confirmed',
                },
              }),
            ]
          : []),
      ])
    }
  }

  reply.status(200).send({
    received: true,
  })
}

export async function webhookRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post(
    '/webhooks/paystack',
    {
      schema: swaggerSchemas.paystackWebhook,
    },
    handleWebhook
  )
}