import amqp, { type Channel } from "amqplib"

export enum SimpleQueueType {
    Durable,
    Transient,
}

export async function declareAndBind(
    conn: amqp.ChannelModel,
    exchange: string,
    queueName: string,
    key: string,
    queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
    const chan = await conn.createChannel()
    const replies = await chan.assertQueue(queueName, {
        durable: queueType === SimpleQueueType.Durable,
        autoDelete: queueType === SimpleQueueType.Transient,
        exclusive: queueType === SimpleQueueType.Transient
    })
    await chan.bindQueue(queueName, exchange, key)
    return [chan, replies]
}