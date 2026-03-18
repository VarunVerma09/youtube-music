import { socket } from "../socket";
import type { Participant, Role } from "../types";

interface Props {
  participants: Participant[];
  myId: string;
  myRole: Role;
  roomId: string;
}

export function ParticipantList({ participants, myId, myRole, roomId }: Props) {
  const isHost = myRole === "host";

  const handleAssignRole = (userId: string, role: Role) => {
    socket.emit("assign_role", { roomId, userId, role });
  };

  const handleRemove = (userId: string) => {
    if (confirm("Remove this participant?")) {
      socket.emit("remove_participant", { roomId, userId });
    }
  };

  const handleTransferHost = (userId: string) => {
    if (confirm("Transfer host to this participant?")) {
      socket.emit("transfer_host", { roomId, userId });
    }
  };

  return (
    <div className="participant-list">
      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map((p) => (
          <li key={p.id} className="participant-item">
            <span className="participant-name">
              {p.username} {p.id === myId && <span className="you-tag">(you)</span>}
            </span>
            <span className={`role-badge role-${p.role}`}>{p.role}</span>

            {isHost && p.id !== myId && (
              <div className="host-actions">
                {p.role === "participant" && (
                  <button onClick={() => handleAssignRole(p.id, "moderator")}>Promote</button>
                )}
                {p.role === "moderator" && (
                  <button onClick={() => handleAssignRole(p.id, "participant")}>Demote</button>
                )}
                <button onClick={() => handleTransferHost(p.id)}>Make Host</button>
                <button className="btn-danger-sm" onClick={() => handleRemove(p.id)}>Remove</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
