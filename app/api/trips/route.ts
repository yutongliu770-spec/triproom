import { NextResponse } from "next/server";
import { getDemoRoom } from "@/lib/demo/room";

export async function POST() {
  const room = await getDemoRoom("demo-japan-7d");

  return NextResponse.json(
    {
      trip: room.trip,
      inviteLink: `/room/${room.trip.id}/join`
    },
    { status: 201 }
  );
}
