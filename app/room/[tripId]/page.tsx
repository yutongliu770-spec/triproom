import { RoomExperience } from "@/components/room/RoomExperience";
import { getDemoRoom } from "@/lib/demo/room";

export default async function RoomPage() {
  const room = await getDemoRoom();

  return <RoomExperience initialRoom={room} />;
}
