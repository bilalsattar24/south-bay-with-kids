import type { EventPick, Issue } from "@/lib/issues";

export function pick(overrides: Partial<EventPick> = {}): EventPick {
  return {
    name: "Turtle and Tortoise Day",
    url: "https://www.friendsofmadronamarsh.com/events/turtle-and-tortoise-day/",
    section: "this-weekend",
    when: "Saturday, October 10, 10:00 a.m.–4:00 p.m.",
    city: "Torrance",
    address: "Madrona Marsh Nature Center, 3201 Plaza del Amo",
    family_of_4_estimate: 0,
    cost_kind: "free",
    why: "Live turtles and tortoises for all ages.",
    ...overrides,
  };
}

export function issue(date: string, picks: EventPick[], overrides: Partial<Issue> = {}): Issue {
  const slug = `${date}-test`;
  return {
    slug,
    date,
    dateLabel: date,
    title: "Test issue",
    intro: "Intro",
    href: `/issues/${slug}`,
    picks,
    last_checked_at: `${date}T05:00:00-07:00`,
    ...overrides,
  };
}
