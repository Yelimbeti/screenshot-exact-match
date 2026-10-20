export type ExtractedQuestion = {
  number: string;
  question: string;
  options: { label: string; text: string }[];
  unreadable: boolean;
};
