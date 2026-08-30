import { NextResponse } from "next/server";
import { getDemoRoom } from "@/lib/demo/room";

export async function POST() {
  const room = await getDemoRoom();

  return NextResponse.json(
    {
      trip: room.trip,
      inviteLink: `/room/${room.trip.id}/join`
    },
    { status: 201 }
  );
}
