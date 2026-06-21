import { NextResponse } from "next/server";
import { Environment, EventName, Paddle } from "@paddle/paddle-node-sdk";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

const paddle = new Paddle(process.env.PADDLE_API_KEY || "", {
    environment: Environment.sandbox,
});

type PaddleCustomData = {
    user_id?: string;
    email?: string;
};

function getCustomData(eventData: unknown): PaddleCustomData {
    if (
        typeof eventData === "object" &&
        eventData !== null &&
        "customData" in eventData
    ) {
        const customData = (eventData as { customData?: unknown }).customData;

        if (typeof customData === "object" && customData !== null) {
            return customData as PaddleCustomData;
        }
    }

    return {};
}

async function markUserAsPaid(userId: string, email?: string) {
    const { error } = await supabaseAdmin
        .from("profiles")
        .upsert(
            {
                user_id: userId,
                email: email || null,
                plan: "paid",
                subscription_status: "active",
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "user_id",
            }
        );

    if (error) {
        throw error;
    }
}

async function markUserAsFree(userId: string, email?: string) {
    const { error } = await supabaseAdmin
        .from("profiles")
        .upsert(
            {
                user_id: userId,
                email: email || null,
                plan: "free",
                subscription_status: "canceled",
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "user_id",
            }
        );

    if (error) {
        throw error;
    }
}

export async function POST(request: Request) {
    const signature = request.headers.get("Paddle-Signature");
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        return NextResponse.json(
            { error: "Missing webhook signature or secret" },
            { status: 400 }
        );
    }

    const rawBody = await request.text();

    try {
        const event = await paddle.webhooks.unmarshal(
            rawBody,
            webhookSecret,
            signature
        );

        const customData = getCustomData(event.data);
        const userId = customData.user_id;
        const email = customData.email;

        if (!userId) {
            return NextResponse.json({
                received: true,
                skipped: "Missing user_id in customData",
                eventType: event.eventType,
            });
        }

        if (
            event.eventType === EventName.TransactionCompleted ||
            event.eventType === EventName.SubscriptionCreated ||
            event.eventType === EventName.SubscriptionUpdated
        ) {
            await markUserAsPaid(userId, email);
        }

        if (event.eventType === EventName.SubscriptionCanceled) {
            await markUserAsFree(userId, email);
        }

        return NextResponse.json({
            received: true,
            eventType: event.eventType,
        });
    } catch (error) {
        console.error("Paddle webhook error:", error);

        return NextResponse.json(
            { error: "Webhook verification failed" },
            { status: 400 }
        );
    }
}