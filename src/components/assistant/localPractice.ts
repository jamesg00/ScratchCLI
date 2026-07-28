import type { InterviewDifficulty } from "../../stores/interviewStore";

/** Local canned practice when Grok is unavailable (interview / palette). */
export function localPracticeScaffold(difficulty: InterviewDifficulty): {
  fileName: string;
  content: string;
  title: string;
} {
  if (difficulty === "easy") {
    return {
      fileName: "two_sum_practice.py",
      title: "Two Sum (easy)",
      content: `# FILE: two_sum_practice.py
# Difficulty: Easy
# Return indices of two numbers that add to target.

def two_sum(nums: list[int], target: int) -> list[int]:
    # TODO: replace pass
    pass


if __name__ == "__main__":
    tests = [
        ("example", [2, 7, 11, 15], 9, [0, 1]),
        ("negatives", [-1, -2, -3, -4, -5], -8, [2, 4]),
        ("duplicates", [3, 3], 6, [0, 1]),
    ]
    passed = 0
    for name, nums, target, expected in tests:
        try:
            got = two_sum(nums, target)
            ok = sorted(got) == sorted(expected)
        except Exception:
            ok = False
        if ok:
            passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name}")
    print(f"{passed} / {len(tests)}")
`,
    };
  }
  if (difficulty === "hard") {
    return {
      fileName: "merge_k_lists_stub.py",
      title: "Merge intervals (hard)",
      content: `# FILE: merge_intervals_practice.py
# Difficulty: Hard
# Merge overlapping intervals.

def merge(intervals: list[list[int]]) -> list[list[int]]:
    # TODO: replace pass
    pass


if __name__ == "__main__":
    tests = [
        ("basic", [[1, 3], [2, 6], [8, 10], [15, 18]], [[1, 6], [8, 10], [15, 18]]),
        ("touch", [[1, 4], [4, 5]], [[1, 5]]),
        ("single", [[1, 4]], [[1, 4]]),
    ]
    passed = 0
    for name, inp, expected in tests:
        try:
            got = merge(inp)
            ok = got == expected
        except Exception:
            ok = False
        if ok:
            passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name}")
    print(f"{passed} / {len(tests)}")
`,
    };
  }
  return {
    fileName: "binary_search_practice.py",
    title: "Binary Search (medium)",
    content: `# FILE: binary_search_practice.py
# Difficulty: Medium
# Return index of target in sorted nums, or -1.

def binary_search(nums: list[int], target: int) -> int:
    # TODO: replace pass
    pass


if __name__ == "__main__":
    tests = [
        ("found", [-1, 0, 3, 5, 9, 12], 9, 4),
        ("missing", [-1, 0, 3, 5, 9, 12], 2, -1),
        ("first", [1, 2, 3], 1, 0),
    ]
    passed = 0
    for name, nums, target, expected in tests:
        try:
            ok = binary_search(nums, target) == expected
        except Exception:
            ok = False
        if ok:
            passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name}")
    print(f"{passed} / {len(tests)}")
`,
  };
}
