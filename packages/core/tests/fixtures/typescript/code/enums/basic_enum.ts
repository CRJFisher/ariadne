/**
 * Basic enum definitions
 * Tests: numeric enums, computed members, enum methods
 */

// Numeric enum
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// Enum with explicit values
enum Status {
  Pending = 0,
  Active = 1,
  Completed = 2,
  Failed = 3,
}

// Enum with computed members
enum FileAccess {
  None = 0,
  Read = 1 << 0,
  Write = 1 << 1,
  Execute = 1 << 2,
  ReadWrite = Read | Write,
}

// Using enums
function move(direction: Direction): string {
  switch (direction) {
    case Direction.Up:
      return "Moving up";
    case Direction.Down:
      return "Moving down";
    case Direction.Left:
      return "Moving left";
    case Direction.Right:
      return "Moving right";
  }
}

function getStatusMessage(status: Status): string {
  switch (status) {
    case Status.Pending:
      return "Waiting to start";
    case Status.Active:
      return "Currently running";
    case Status.Completed:
      return "Successfully completed";
    case Status.Failed:
      return "Failed with error";
  }
}

export { Direction, Status, FileAccess, move, getStatusMessage };
