import amqp from "amqplib"
import { declareAndBind, type SimpleQueueType } from "./declareAndBind.js";

export enum AckType {
    Ack,
    NackRequeue,
    NackDiscard
}
export async function subscribeJSON<T>(
    conn: amqp.ChannelModel,
    exchange: string,
    queueName: string,
    key: string,
    queueType: SimpleQueueType,
    handler: (data: T) => Promise<AckType> | AckType,
) {
    const [chan] = await declareAndBind(
        conn,
        exchange,
        queueName,
        key,
        queueType
    );

    await chan.consume(queueName, function (msg: amqp.ConsumeMessage | null) {
        if (!msg) return
        let data: T;
        try {
            data = JSON.parse(msg.content.toString())
        } catch (err) {
            console.error("Could not unmarshal message", err)
            return
        }
        const ack = handler(data)

        switch (ack) {
            case AckType.Ack:
                chan.ack(msg)
                console.log("Acknowledge")
                break;
            case AckType.NackRequeue:
                chan.nack(msg, false, true)
                console.log("Negative Acknowledge requeue")
                break;
            case AckType.NackDiscard:
                chan.nack(msg, false, false)
                console.log("Negative Acknowledge discard")
                break;
        }
    })
}