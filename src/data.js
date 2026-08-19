import { ClipboardCheck, MessageSquare, FileText } from "lucide-react";

// ---- Mock content: Jet Turbine Fundamentals ----
// This is where your real question bank, videos, and PDFs will eventually live.
const MODULES = [
  { code: "JT", name: "Jet Turbine Fundamentals", status: "active", questions: 10 },
  { code: "PROP", name: "Propulsion Systems (coming soon)", status: "locked", questions: 0 },
];

const CHAPTERS = [
  {
    id: "ch1",
    code: "JT.01",
    title: "Intake & Compressor Stages",
    duration: "11:20",
    clip: "https://www.youtube.com/embed/CXSi4GXUojo",
    isPlaceholder: false,
    questions: [
      {
        id: "q1",
        stem: "In a jet engine's compressor, each successive stage generally has:",
        options: [
          "Larger blades and lower pressure than the previous stage",
          "Smaller blades and higher pressure than the previous stage",
          "The same blade size and pressure throughout",
          "Blades only on odd-numbered stages",
        ],
        answer: 1,
      },
      {
        id: "q2",
        stem: "An axial-flow compressor moves air:",
        options: [
          "Outward, perpendicular to the engine's centerline",
          "Parallel to the engine's centerline, stage by stage",
          "In a single reverse loop before combustion",
          "Only during engine start-up",
        ],
        answer: 1,
      },
      {
        id: "q3",
        stem: "Compressor stall is most likely to occur when:",
        options: [
          "Airflow into the compressor becomes smooth and steady",
          "Airflow is disrupted, causing blades to lose aerodynamic lift",
          "The engine is idling on the ground",
          "Fuel flow is reduced to zero",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch2",
    code: "JT.02",
    title: "Combustion Chamber Basics",
    duration: "14:50",
    clip: "https://www.youtube.com/embed/xycmedGUdB4",
    isPlaceholder: false,
    questions: [
      {
        id: "q4",
        stem: "The primary purpose of the combustion chamber is to:",
        options: [
          "Cool the compressed air before it reaches the turbine",
          "Add fuel and burn it to raise the energy of the airflow",
          "Compress air further before exhaust",
          "Reduce the velocity of exhaust gases",
        ],
        answer: 1,
      },
      {
        id: "q5",
        stem: "Igniters in the combustion chamber are typically used:",
        options: [
          "Continuously throughout the entire flight",
          "Only during engine start, since combustion becomes self-sustaining after",
          "Only during descent",
          "Only when the engine is shut down",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch3",
    code: "JT.03",
    title: "Turbine Section & Energy Extraction",
    duration: "16:35",
    clip: "https://www.youtube.com/embed/6bJ8Q79CHio",
    isPlaceholder: false,
    questions: [
      {
        id: "q6",
        stem: "The turbine section extracts energy from the hot gas stream mainly to:",
        options: [
          "Increase exhaust temperature",
          "Drive the compressor and accessories",
          "Slow the aircraft during descent",
          "Cool the combustion chamber",
        ],
        answer: 1,
      },
      {
        id: "q7",
        stem: "Turbine blades are typically made from materials that prioritize:",
        options: [
          "Low cost over performance",
          "High-temperature strength and creep resistance",
          "Maximum flexibility at room temperature",
          "Low density above all other properties",
        ],
        answer: 1,
      },
      {
        id: "q8",
        stem: "Nozzle guide vanes ahead of the turbine exist mainly to:",
        options: [
          "Add fuel before the gas reaches the turbine",
          "Direct the gas stream onto the turbine blades at the correct angle",
          "Cool the compressor",
          "Generate electrical power",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch4",
    code: "JT.04",
    title: "Exhaust & Thrust Generation",
    duration: "13:05",
    clip: "https://www.youtube.com/embed/BxomJafd3Rs",
    isPlaceholder: false,
    questions: [
      {
        id: "q9",
        stem: "Thrust in a jet engine is produced mainly as a result of:",
        options: [
          "Newton's third law — accelerating air rearward",
          "The engine's weight pressing down on the airframe",
          "Friction between the exhaust and outside air",
          "The compressor spinning at high RPM",
        ],
        answer: 0,
      },
      {
        id: "q10",
        stem: "As altitude increases, air density decreases, which generally causes jet engine thrust to:",
        options: [
          "Increase, due to less aerodynamic drag on the engine",
          "Decrease, due to less air mass available to accelerate",
          "Stay exactly the same at all altitudes",
          "Increase only above the speed of sound",
        ],
        answer: 1,
      },
    ],
  },
];

const PDFS = [
  { id: "p1", title: "JT.02 — Combustion Chamber: Study Notes", pages: 10, size: "980 KB" },
  { id: "p2", title: "JT.03 — Turbine Section: Summary Sheet", pages: 6, size: "520 KB" },
  { id: "p3", title: "Jet Turbine Fundamentals — Key Terms Reference", pages: 4, size: "300 KB" },
];

const NAV = [
  { id: "chapters", label: "Chapters", icon: ClipboardCheck },
  { id: "discuss", label: "Discussion", icon: MessageSquare },
  { id: "pdf", label: "Library", icon: FileText },
];


const TRIVIA = [
  "The Boeing 747's wingspan (68.4 m) is longer than the Wright brothers' first powered flight (36.5 m).",
  "A jet engine can process enough air per second to fill a small house.",
  "Concorde could cross the Atlantic in under 3.5 hours — faster than the Earth's own rotation beneath it.",
  "At a typical 35,000 ft cruising altitude, the sky above starts to look noticeably darker.",
  "Some turbine blades spin at speeds exceeding 10,000 RPM.",
];

const ACCENT_COLORS = {
  blue: {
    label: "Sky Blue",
    swatch: "#6FA0F0",
    dark: { accent: "#6FA0F0", hover: "#8FB8F5", soft: "rgba(111,160,240,0.10)", onAccent: "#0E1830" },
    light: { accent: "#3D6FD1", hover: "#5A8AE0", soft: "rgba(61,111,209,0.08)", onAccent: "#FFFFFF" },
  },
  green: {
    label: "Runway Green",
    swatch: "#4CAF7D",
    dark: { accent: "#4CAF7D", hover: "#6BC494", soft: "rgba(76,175,125,0.12)", onAccent: "#06210F" },
    light: { accent: "#2F9D64", hover: "#4BB57D", soft: "rgba(47,157,100,0.10)", onAccent: "#FFFFFF" },
  },
  red: {
    label: "Beacon Red",
    swatch: "#E5484D",
    dark: { accent: "#E5484D", hover: "#ED6F73", soft: "rgba(229,72,77,0.12)", onAccent: "#2A0C0D" },
    light: { accent: "#D14F4F", hover: "#DB6B6B", soft: "rgba(209,79,79,0.10)", onAccent: "#FFFFFF" },
  },
  amber: {
    label: "Gauge Amber",
    swatch: "#E8A33D",
    dark: { accent: "#E8A33D", hover: "#EDB563", soft: "rgba(232,163,61,0.12)", onAccent: "#2A1B04" },
    light: { accent: "#C77F1D", hover: "#D89A44", soft: "rgba(199,127,29,0.10)", onAccent: "#FFFFFF" },
  },
  grey: {
    label: "Tarmac Grey",
    swatch: "#9BA8B8",
    dark: { accent: "#9BA8B8", hover: "#B3BEC9", soft: "rgba(155,168,184,0.12)", onAccent: "#101B26" },
    light: { accent: "#5C6B7D", hover: "#7A8AA0", soft: "rgba(92,107,125,0.10)", onAccent: "#FFFFFF" },
  },
};

export { MODULES, CHAPTERS, PDFS, NAV, TRIVIA, ACCENT_COLORS };
