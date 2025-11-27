/**
 * Basic enum definitions
 * Tests: numeric enums, computed members, enum methods
 */

// Numeric enum
enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

// Enum with explicit values
enum Status {
  PENDING = 0,
  ACTIVE = 1,
  COMPLETED = 2,
  FAILED = 3,
}

// Enum with computed members
enum FileAccess {
  NONE = 0,
  READ = 1 << 0,
  WRITE = 1 << 1,
  EXECUTE = 1 << 2,
  READ_WRITE = READ | WRITE,
}

// Using enums
function move(direction: Direction): string {
  switch (direction) {
    case Direction.UP:
      return "Moving up";
    case Direction.DOWN:
      return "Moving down";
    case Direction.LEFT:
      return "Moving left";
    case Direction.RIGHT:
      return "Moving right";
  }
}

function get_status_message(status: Status): string {
  switch (status) {
    case Status.PENDING:
      return "Waiting to start";
    case Status.ACTIVE:
      return "Currently running";
    case Status.COMPLETED:
      return "Successfully completed";
    case Status.FAILED:
      return "Failed with error";
  }
}

export { Direction, Status, FileAccess, move, get_status_message };
