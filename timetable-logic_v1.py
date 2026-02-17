from dataclasses import dataclass
from typing import List, Dict, Tuple

@dataclass(frozen=True)
class Subject:
    name: str
    difficulty: int

@dataclass
class Block:
    subject: str
    minutes: int
    kind: str  # "review" or "new"

def weighted_minutes(subjects: List[Subject], total_minutes: int) -> Dict[str, int]:
    total_weight = sum(s.difficulty for s in subjects)
    raw = {s.name: (s.difficulty / total_weight) * total_minutes for s in subjects}

    alloc = {k: int(v) for k, v in raw.items()}
    used = sum(alloc.values())
    remaining = total_minutes - used

    frac = sorted(
        ((k, raw[k] - alloc[k]) for k in raw),
        key=lambda x: x[1],
        reverse=True
    )

    i = 0
    while remaining > 0:
        alloc[frac[i][0]] += 1
        remaining -= 1
        i = (i + 1) % len(frac)

    return alloc

def build_schedule(
    subjects: List[Subject],
    daily_minutes: int,
    num_days: int,
    review_offsets=(1, 3, 7),
    review_fraction=0.30
) -> Dict[int, List[Block]]:

    base_alloc = weighted_minutes(subjects, daily_minutes)
    review_queue: Dict[int, List[Tuple[str, int]]] = {}
    schedule: Dict[int, List[Block]] = {}

    for day in range(1, num_days + 1):
        minutes_left = daily_minutes
        blocks: List[Block] = []

        # reviews first
        for sub, mins in review_queue.get(day, []):
            if minutes_left <= 0:
                break
            take = min(mins, minutes_left)
            blocks.append(Block(sub, take, "review"))
            minutes_left -= take

        # new study
        if minutes_left > 0:
            new_alloc = weighted_minutes(subjects, minutes_left)
            for sub, mins in new_alloc.items():
                blocks.append(Block(sub, mins, "new"))

                review_mins = max(1, int(base_alloc[sub] * review_fraction))
                for off in review_offsets:
                    target = day + off
                    if target <= num_days:
                        review_queue.setdefault(target, []).append((sub, review_mins))

        schedule[day] = blocks

    return schedule

def print_table(schedule: Dict[int, List[Block]]) -> None:
    print("\nSTUDY TIMETABLE\n")
    print(f"{'Day':<5}{'Subject':<10}{'Minutes':<10}{'Type':<10}")
    print("-" * 35)

    for day in schedule:
        for block in schedule[day]:
            print(f"{day:<5}{block.subject:<10}{block.minutes:<10}{block.kind:<10}")

if __name__ == "__main__":
    subjects = [
        Subject("Math", 5),
        Subject("CS", 4),
        Subject("Chem", 3),
    ]

    schedule = build_schedule(
        subjects=subjects,
        daily_minutes=120,
        num_days=10
    )

    print_table(schedule)
