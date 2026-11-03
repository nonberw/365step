import { BANK365 } from "../../shared/bank365";
import type { IeltsChoiceQuestion } from "../../shared/types";

// Original IELTS-style practice material written for 365step.
// Not taken from official IELTS tests or from other prep platforms.

export const SPEAKING_PART1: { id: string; topic: string; questions: string[] }[] = [
  { id: "p1-home", topic: "Your home town", questions: ["Where is your home town?", "What do you like most about it?", "How has it changed in recent years?"] },
  { id: "p1-study", topic: "Studies", questions: ["What subject do you enjoy most at school?", "Why do you find it interesting?", "Is there a subject you would like to study in the future?"] },
  { id: "p1-tech", topic: "Technology", questions: ["How often do you use your phone for studying?", "Which app do you use most?", "Do you think people spend too much time online?"] },
  { id: "p1-food", topic: "Food", questions: ["What is a typical meal in your family?", "Do you like cooking?", "Has your taste in food changed since childhood?"] },
  { id: "p1-weekend", topic: "Weekends", questions: ["What do you usually do at weekends?", "Do you prefer busy or relaxing weekends?", "What did you do last weekend?"] },
  { id: "p1-music", topic: "Music", questions: ["What kind of music do you listen to?", "Have you ever learned to play an instrument?", "Is traditional music popular among young people in your country?"] },
];

export const SPEAKING_PART2: { id: string; topic: string; points: string[]; part3: string[] }[] = [
  {
    id: "p2-teacher",
    topic: "Describe a teacher who has influenced you.",
    points: ["who this teacher is", "what subject they teach", "what they did that was special", "and explain how they influenced you"],
    part3: ["What qualities make a good teacher?", "Will AI ever replace teachers in schools?", "Should teachers be paid more than other professionals?"],
  },
  {
    id: "p2-place",
    topic: "Describe a place in nature you enjoy visiting.",
    points: ["where it is", "how often you go there", "what you do there", "and explain why you enjoy it"],
    part3: ["Why do people in cities need access to nature?", "How can governments protect natural areas?", "Do you think tourism harms the environment?"],
  },
  {
    id: "p2-skill",
    topic: "Describe a skill you learned that took a long time.",
    points: ["what the skill is", "when you started learning it", "what difficulties you had", "and explain how you feel about it now"],
    part3: ["Are some skills easier to learn when you are young?", "Should schools teach practical skills like cooking?", "How has the internet changed the way people learn skills?"],
  },
  {
    id: "p2-app",
    topic: "Describe an app or website that you find useful.",
    points: ["what it is", "how you found it", "what you use it for", "and explain why it is useful"],
    part3: ["How has technology changed education?", "What are the risks of children using apps too much?", "Will people still read printed books in the future?"],
  },
  {
    id: "p2-event",
    topic: "Describe a celebration you remember well.",
    points: ["what the celebration was", "where it took place", "who was there", "and explain why you remember it"],
    part3: ["Why are traditional celebrations important?", "Are celebrations becoming too commercial?", "How do celebrations differ between generations?"],
  },
  {
    id: "p2-goal",
    topic: "Describe a goal you hope to achieve in the next five years.",
    points: ["what the goal is", "why you chose it", "what you need to do to reach it", "and explain how you will feel if you achieve it"],
    part3: ["Is it important for young people to set long-term goals?", "Do parents put too much pressure on children to succeed?", "What makes some people more successful than others?"],
  },
  {
    id: "p2-book",
    topic: "Describe a book or film that made you think.",
    points: ["what it was", "when you read or watched it", "what it was about", "and explain why it made you think"],
    part3: ["Do films have more influence on young people than books?", "Should schools choose which books students read?", "Why do some stories remain popular for centuries?"],
  },
  {
    id: "p2-help",
    topic: "Describe a time you helped someone.",
    points: ["who you helped", "what the situation was", "how you helped", "and explain how you felt afterwards"],
    part3: ["Why do some people volunteer?", "Should helping in the community be part of the school curriculum?", "Are people less helpful in big cities?"],
  },
];

export const WRITING_TASK2: { id: string; type: string; prompt: string }[] = [
  { id: "w2-ai-teachers", type: "Opinion", prompt: "Some people believe that artificial intelligence will soon make human teachers unnecessary. To what extent do you agree or disagree?" },
  { id: "w2-phones", type: "Discussion", prompt: "Some people think that mobile phones should be banned in schools, while others believe they are useful learning tools. Discuss both views and give your own opinion." },
  { id: "w2-abroad", type: "Advantages / Disadvantages", prompt: "More and more young people choose to study at universities abroad. Do the advantages of this trend outweigh the disadvantages?" },
  {
    id: "w2-cities",
    type: "Problem / Solution",
    prompt: "In many cities, traffic congestion and air pollution are growing problems. What are the causes of these problems, and what measures could be taken to solve them?",
  },
  { id: "w2-exams", type: "Opinion", prompt: "Some people argue that exams are not a good way to measure students' abilities. To what extent do you agree or disagree?" },
  {
    id: "w2-languages",
    type: "Discussion",
    prompt: "Some people believe that children should learn several foreign languages at primary school, while others think it is better to focus on one. Discuss both views and give your opinion.",
  },
  { id: "w2-sport", type: "Opinion", prompt: "Governments should spend more money on public sports facilities than on professional sports teams. To what extent do you agree or disagree?" },
  { id: "w2-online", type: "Advantages / Disadvantages", prompt: "Online learning has become common in many countries. Do the advantages of online learning outweigh its disadvantages?" },
  {
    id: "w2-environment",
    type: "Two-part question",
    prompt: "Many people say that individuals cannot do much to protect the environment and that only governments and companies can make a difference. Why do people think this? Do you agree?",
  },
  { id: "w2-work", type: "Opinion", prompt: "Some people think that students should do paid part-time work while at school. To what extent do you agree or disagree?" },
];

export interface ChartData {
  id: string;
  title: string;
  kind: "bar" | "line";
  unit: string;
  categories: string[];
  series: { name: string; values: number[] }[];
}

/** Synthetic data for Writing Task 1 (the client draws the chart). */
export const WRITING_TASK1: (ChartData & { prompt: string })[] = [
  {
    id: "w1-transport",
    kind: "bar",
    title: "How students get to school in a city, 2015 and 2025",
    unit: "% of students",
    categories: ["Bus", "Car", "Walking", "Bicycle", "Metro"],
    series: [
      { name: "2015", values: [38, 31, 18, 5, 8] },
      { name: "2025", values: [30, 22, 16, 12, 20] },
    ],
    prompt:
      "The chart below shows how students in one city travelled to school in 2015 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
  },
  {
    id: "w1-internet",
    kind: "line",
    title: "Average daily hours online by age group, 2016–2024",
    unit: "hours per day",
    categories: ["2016", "2018", "2020", "2022", "2024"],
    series: [
      { name: "13–17", values: [3.1, 3.8, 5.6, 5.2, 5.4] },
      { name: "18–34", values: [3.5, 3.9, 5.1, 4.8, 4.9] },
      { name: "35–54", values: [1.8, 2.2, 3.4, 3.1, 3.3] },
      { name: "55+", values: [0.7, 1.0, 1.9, 2.0, 2.3] },
    ],
    prompt:
      "The graph below shows the average number of hours people in four age groups spent online each day between 2016 and 2024. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
  },
  {
    id: "w1-energy",
    kind: "bar",
    title: "Electricity sources in a country, 2010 and 2025",
    unit: "% of total",
    categories: ["Coal", "Gas", "Hydro", "Wind", "Solar"],
    series: [
      { name: "2010", values: [72, 15, 11, 1, 1] },
      { name: "2025", values: [54, 20, 10, 9, 7] },
    ],
    prompt:
      "The chart below compares the sources of electricity in one country in 2010 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
  },
  {
    id: "w1-library",
    kind: "line",
    title: "Monthly visitors to a school library (hundreds)",
    unit: "hundreds of visitors",
    categories: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"],
    series: [
      { name: "Printed books", values: [12, 11, 10, 8, 9, 8, 7, 7, 6] },
      { name: "Study rooms", values: [5, 6, 9, 14, 7, 8, 10, 13, 18] },
    ],
    prompt:
      "The graph below shows the number of visitors to a school library for borrowing printed books and for using study rooms over one school year. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
  },
];

// ---------- Reading ----------

type Keyed = IeltsChoiceQuestion & { answer: string; why: string };

export const READING: { id: string; title: string; level: string; passage: string; questions: Keyed[] }[] = [
  {
    id: "r-glacier",
    title: "The Shrinking Glaciers of the Tien Shan",
    level: "Academic · Passage 1",
    passage: `A The glaciers of the Tien Shan mountains, which stretch across Kazakhstan, Kyrgyzstan and China, supply much of the water that flows into the region's rivers during the hot summer months. For cities such as Almaty and Bishkek, these slow-moving rivers of ice act as natural reservoirs, storing winter snow and releasing it gradually as meltwater.

B Since the middle of the twentieth century, however, scientists have recorded a steady retreat of these glaciers. The Tuyuksu glacier near Almaty, one of the most closely studied in the world, has lost more than a third of its area since monitoring began in 1957. Researchers attribute the loss mainly to rising summer temperatures, although changes in snowfall also play a role.

C In the short term, faster melting can actually increase the amount of water in rivers, a phenomenon sometimes called 'peak water'. Farmers downstream may notice fuller rivers and assume that the supply is secure. Hydrologists warn that this is misleading: once a glacier becomes small enough, the summer flow begins to fall, and it may not recover.

D Adapting to this future will require more than technical solutions. While new reservoirs and more efficient irrigation can reduce waste, experts emphasise that cooperation between countries is equally important, because the rivers fed by the Tien Shan cross national borders. Several regional programmes now share data on snow cover and river flow, allowing governments to plan together rather than compete for a shrinking resource.`,
    questions: [
      { id: "1", kind: "tfng", text: "The Tien Shan glaciers supply water to rivers mainly in winter.", answer: "FALSE", why: "Абзац A: вода поступает «during the hot summer months»." },
      { id: "2", kind: "tfng", text: "The Tuyuksu glacier has been monitored since the 1950s.", answer: "TRUE", why: "Абзац B: «since monitoring began in 1957»." },
      { id: "3", kind: "tfng", text: "Changes in snowfall are the main reason for glacier loss.", answer: "FALSE", why: "Главная причина — летние температуры; снегопад только «also play a role»." },
      { id: "4", kind: "tfng", text: "Most farmers in the region have already changed their irrigation methods.", answer: "NOT GIVEN", why: "Про то, сколько фермеров уже сменили методы, в тексте ничего нет." },
      {
        id: "5",
        kind: "mcq",
        text: "According to paragraph C, 'peak water' refers to",
        options: ["A a permanent rise in river levels", "B a temporary increase in river flow caused by faster melting", "C the highest point of a glacier", "D the time when farmers use the most water"],
        answer: "B",
        why: "Абзац C: быстрое таяние в краткосрочной перспективе увеличивает воду в реках — это временно.",
      },
      {
        id: "6",
        kind: "mcq",
        text: "What do experts say is equally important as technical solutions?",
        options: ["A building larger cities", "B reducing summer temperatures", "C cooperation between countries", "D stopping all irrigation"],
        answer: "C",
        why: "Абзац D: «cooperation between countries is equally important».",
      },
      { id: "7", kind: "gap", text: "Regional programmes share data on snow cover and river ______.", answer: "flow", why: "Абзац D: «share data on snow cover and river flow»." },
    ],
  },
  {
    id: "r-sleep",
    title: "Why Teenagers Need More Sleep",
    level: "Academic · Passage 2",
    passage: `A For decades, parents and teachers have complained that teenagers stay up too late and struggle to wake up for school. Many assumed that this was simply a matter of discipline. Research in sleep science, however, suggests that the problem is largely biological.

B During adolescence, the body's internal clock shifts. The hormone melatonin, which signals that it is time to sleep, is released about two hours later in teenagers than in younger children or adults. As a result, a typical sixteen-year-old may not feel sleepy until eleven at night or later, even if they are tired.

C At the same time, most teenagers need between eight and ten hours of sleep to function well. When school starts early, many students regularly get less than seven hours. The effects of this shortage include poorer concentration, lower mood and, according to several studies, weaker performance in mathematics and reading.

D Some schools have experimented with later start times. In one well-known case, a group of schools moved the start of the day from 7:30 to 8:30. Over the following year, attendance improved and the number of students arriving late fell sharply. Critics point out, though, that later starts can create difficulties for families and for after-school activities, and that results may differ between communities.`,
    questions: [
      { id: "1", kind: "tfng", text: "Teenagers' late bedtimes are mainly caused by a lack of discipline.", answer: "FALSE", why: "Абзац A: исследования показывают, что причина «largely biological»." },
      { id: "2", kind: "tfng", text: "Melatonin is released later in teenagers than in adults.", answer: "TRUE", why: "Абзац B: примерно на два часа позже, чем у детей и взрослых." },
      { id: "3", kind: "tfng", text: "All teenagers need exactly nine hours of sleep.", answer: "FALSE", why: "Абзац C: от восьми до десяти часов, а не ровно девять." },
      { id: "4", kind: "tfng", text: "Lack of sleep has been linked to weaker results in mathematics.", answer: "TRUE", why: "Абзац C: «weaker performance in mathematics and reading»." },
      {
        id: "5",
        kind: "mcq",
        text: "In the schools that started at 8:30, what happened over the following year?",
        options: ["A Exam scores doubled", "B Fewer students arrived late", "C After-school clubs were cancelled", "D Teachers worked shorter days"],
        answer: "B",
        why: "Абзац D: посещаемость выросла, опозданий стало заметно меньше.",
      },
      {
        id: "6",
        kind: "mcq",
        text: "What concern do critics raise about later start times?",
        options: ["A They make teenagers sleep too much", "B They are illegal in some countries", "C They can be difficult for families and activities", "D They reduce attendance"],
        answer: "C",
        why: "Абзац D: «difficulties for families and for after-school activities».",
      },
      { id: "7", kind: "gap", text: "A typical sixteen-year-old may not feel sleepy until ______ at night.", answer: "eleven|11", why: "Абзац B: «until eleven at night or later»." },
    ],
  },
];

// ---------- Listening (read aloud by the browser's speech synthesis) ----------

export const LISTENING: { id: string; title: string; section: string; script: { voice: "a" | "b"; text: string }[]; questions: Keyed[] }[] = [
  {
    id: "l-club",
    title: "Joining the robotics club",
    section: "Section 1 · conversation",
    script: [
      { voice: "a", text: "Good afternoon, robotics club, this is Marat speaking. How can I help?" },
      { voice: "b", text: "Hi, my name is Dana Seitkali. I'd like to join the club this term." },
      { voice: "a", text: "Great. Could you spell your surname for me?" },
      { voice: "b", text: "Sure. S, E, I, T, K, A, L, I." },
      { voice: "a", text: "Thank you. Which grade are you in?" },
      { voice: "b", text: "I'm in grade nine." },
      { voice: "a", text: "Perfect. We meet twice a week, on Tuesdays and Thursdays, from four to six in room two hundred and fourteen." },
      { voice: "b", text: "Is there a fee?" },
      { voice: "a", text: "The club itself is free, but you'll need a starter kit. It costs eight thousand tenge, and you can pay at the first meeting." },
      { voice: "b", text: "Do I need to bring a laptop?" },
      { voice: "a", text: "Not for the first month. We provide tablets. Later, when we start programming the robots, a laptop is useful but not required." },
      { voice: "b", text: "And when is the first meeting?" },
      { voice: "a", text: "On the fifteenth of September. Please arrive ten minutes early so we can register you." },
    ],
    questions: [
      { id: "1", kind: "gap", text: "Student's surname: ______", answer: "Seitkali", why: "Фамилию продиктовали по буквам: S-E-I-T-K-A-L-I." },
      { id: "2", kind: "gap", text: "Grade: ______", answer: "9|nine", why: "«I’m in grade nine.»" },
      { id: "3", kind: "mcq", text: "The club meets on", options: ["A Mondays and Wednesdays", "B Tuesdays and Thursdays", "C Thursdays only", "D Saturdays"], answer: "B", why: "«on Tuesdays and Thursdays»." },
      { id: "4", kind: "gap", text: "Room number: ______", answer: "214|two hundred and fourteen", why: "«room two hundred and fourteen»." },
      { id: "5", kind: "gap", text: "Cost of the starter kit: ______ tenge", answer: "8000|8 000", why: "«It costs eight thousand tenge»." },
      {
        id: "6",
        kind: "mcq",
        text: "For the first month, students",
        options: ["A must bring a laptop", "B use tablets provided by the club", "C do not use any devices", "D buy their own robots"],
        answer: "B",
        why: "«Not for the first month. We provide tablets.»",
      },
    ],
  },
  {
    id: "l-lecture",
    title: "How bees find their way",
    section: "Section 4 · lecture",
    script: [
      { voice: "a", text: "Today I'd like to talk about one of the most remarkable navigators in nature: the honeybee." },
      { voice: "a", text: "A worker bee may fly up to five kilometres from its hive to find flowers, and yet it almost always returns home. How does it do this?" },
      { voice: "a", text: "The first tool is the sun. Bees use the position of the sun as a compass, and they can even adjust for the sun's movement across the sky during the day." },
      { voice: "a", text: "On cloudy days, bees rely on polarised light, which they can detect even when the sun itself is hidden." },
      { voice: "a", text: "The second tool is landmarks. Close to the hive, bees memorise trees, buildings and other visual features." },
      {
        voice: "a",
        text: "Perhaps the most famous behaviour is the waggle dance. When a bee finds a good source of food, it returns to the hive and performs a dance. The angle of the dance tells other bees the direction, and the length of the waggle tells them the distance.",
      },
      { voice: "a", text: "Researchers have found that pesticides can interfere with this navigation, which may be one reason why bee populations are declining in some regions." },
    ],
    questions: [
      { id: "1", kind: "gap", text: "A worker bee may fly up to ______ kilometres from its hive.", answer: "5|five", why: "«up to five kilometres»." },
      {
        id: "2",
        kind: "mcq",
        text: "On cloudy days, bees navigate using",
        options: ["A the moon", "B polarised light", "C smell only", "D the wind"],
        answer: "B",
        why: "«On cloudy days, bees rely on polarised light».",
      },
      { id: "3", kind: "gap", text: "Near the hive, bees memorise ______ such as trees and buildings.", answer: "landmarks", why: "«The second tool is landmarks»." },
      {
        id: "4",
        kind: "mcq",
        text: "In the waggle dance, the length of the waggle shows",
        options: ["A the direction", "B the type of flower", "C the distance", "D the time of day"],
        answer: "C",
        why: "Угол — направление, длина «виляния» — расстояние.",
      },
      {
        id: "5",
        kind: "mcq",
        text: "According to the lecture, what may interfere with bee navigation?",
        options: ["A mobile phones", "B pesticides", "C cold weather", "D city lights"],
        answer: "B",
        why: "«pesticides can interfere with this navigation».",
      },
      { id: "6", kind: "gap", text: "Bees use the sun as a ______.", answer: "compass", why: "«use the position of the sun as a compass»." },
    ],
  },
];

export function normalise(answer: string) {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(a|b|c|d)\s.*$/, "$1");
}

// Task bank from 365step: more Reading passages, Writing Task 2 topics and Speaking cards.
READING.push(...BANK365.reading.map(({ difficulty: _d, ...r }) => r));
WRITING_TASK2.push(...BANK365.writing2);
SPEAKING_PART1.push(...BANK365.speaking.part1);
SPEAKING_PART2.push(...BANK365.speaking.part2);
