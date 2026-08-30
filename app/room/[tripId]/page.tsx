import { RoomExperience } from "@/components/room/RoomExperience";
import { getDemoRoom } from "@/lib/demo/room";

interface RoomPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { tripId } = await params;
  const room = await getDemoRoom(tripId);

  return <RoomExperience initialRoom={room} />;
}
