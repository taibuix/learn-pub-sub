import type { ConfirmChannel } from "amqplib";

export const publishJSON = async <T>(
    ch: ConfirmChannel,
    exchange: string,
    routingKey: string,
    value: T,
): Promise<void> => {
    const serialized = JSON.stringify(value)
    const buffer = Buffer.from(serialized)
    ch.publish(exchange, routingKey, buffer, {contentType: "application/JSON"})
}