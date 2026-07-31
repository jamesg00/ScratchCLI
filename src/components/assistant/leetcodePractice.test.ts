import { describe, expect, it } from "vitest";
import {
  buildLeetCodeScaffold,
  htmlToPlainText,
  parseExamplesFromText,
  parseInputBindings,
  stubSolutionCode,
} from "./leetcodePractice";
import type { LeetCodeProblem } from "../../services/leetcode";

const TWO_SUM_HTML = `
<p>Given an array of integers <code>nums</code> and an integer <code>target</code>.</p>
<p><strong>Example 1:</strong></p>
<pre>Input: nums = [2,7,11,15], target = 9
Output: [0,1]
</pre>
<p><strong>Example 2:</strong></p>
<pre>Input: nums = [3,2,4], target = 6
Output: [1,2]
</pre>
<p><strong>Constraints:</strong></p>
<ul><li>2 <= nums.length</li></ul>
`;

describe("htmlToPlainText / parseExamples", () => {
  it("parses Two Sum style examples", () => {
    const plain = htmlToPlainText(TWO_SUM_HTML);
    const examples = parseExamplesFromText(plain);
    expect(examples.length).toBeGreaterThanOrEqual(2);
    expect(examples[0]!.bindings).toEqual({ nums: [2, 7, 11, 15], target: 9 });
    expect(examples[0]!.expected).toEqual([0, 1]);
  });

  it("parses input bindings", () => {
    expect(parseInputBindings('s = "hello"')).toEqual({ s: "hello" });
  });
});

describe("stubSolutionCode", () => {
  it("replaces method bodies with pass", () => {
    const stub = stubSolutionCode(`class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # TODO
        return []
`);
    expect(stub).toContain("def twoSum");
    expect(stub).toMatch(/pass/);
    expect(stub).not.toContain("return []");
  });
});

describe("buildLeetCodeScaffold", () => {
  it("builds a practice file with LC marker and examples", () => {
    const problem: LeetCodeProblem = {
      title: "Two Sum",
      titleSlug: "two-sum",
      difficulty: "Easy",
      frontendId: "1",
      content: TWO_SUM_HTML,
      paidOnly: false,
      exampleTestcaseList: ["[2,7,11,15]\n9"],
      codeSnippets: [
        {
          lang: "Python3",
          langSlug: "python3",
          code: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        return []
`,
        },
      ],
      topicTags: ["Array", "Hash Table"],
      url: "https://leetcode.com/problems/two-sum/",
    };
    const { file, warnings, officialCaseCount } = buildLeetCodeScaffold(problem);
    expect(
      warnings.some((w) => /at least 3|minimum 4|need at least 3/i.test(w)),
    ).toBe(false);
    expect(officialCaseCount).toBe(2);
    expect(file.fileName).toBe("two_sum.py");
    expect(file.content).toContain("# LC: two-sum");
    expect(file.content).toContain("def twoSum");
    expect(file.content).toContain("pass");
    expect(file.content).toContain("[2, 7, 11, 15]");
    expect(file.content).toContain("CASES");
    expect(file.content).not.toContain("class ListNode");
  });

  it("injects ListNode helpers and converts list inputs for linked-list problems", () => {
    const html = `
<p>Merge two sorted linked lists.</p>
<p><strong>Example 1:</strong></p>
<pre>Input: list1 = [1,2,4], list2 = [1,3,4]
Output: [1,1,2,3,4,4]
</pre>
<p><strong>Example 2:</strong></p>
<pre>Input: list1 = [], list2 = []
Output: []
</pre>
`;
    const problem: LeetCodeProblem = {
      title: "Merge Two Sorted Lists",
      titleSlug: "merge-two-sorted-lists",
      difficulty: "Easy",
      frontendId: "21",
      content: html,
      paidOnly: false,
      exampleTestcaseList: ["[1,2,4]\n[1,3,4]", "[]\n[]"],
      codeSnippets: [
        {
          lang: "Python3",
          langSlug: "python3",
          code: `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next
class Solution:
    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:
        return None
`,
        },
      ],
      topicTags: ["Linked List"],
      url: "https://leetcode.com/problems/merge-two-sorted-lists/",
    };
    const { file } = buildLeetCodeScaffold(problem);
    expect(file.content).toContain("class ListNode:");
    expect(file.content).toContain("def _to_listnode");
    expect(file.content).toContain("def _from_listnode");
    expect(file.content).toContain("_to_listnode(args[0])");
    expect(file.content).toContain("_to_listnode(args[1])");
    expect(file.content).toContain("_from_listnode(result)");
    expect(file.content).toContain("def mergeTwoLists");
  });
});
