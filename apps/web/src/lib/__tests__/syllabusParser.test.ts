import { describe, it, expect } from "vitest";
import { parseSyllabus, detectKind, stripPrefix } from "../syllabusParser";

describe("Syllabus Parser", () => {
  describe("detectKind", () => {
    it("detects assignments", () => {
      expect(detectKind("Assignment 1: Linear Regression")).toBe("assignment");
      expect(detectKind("HW2")).toBe("assignment");
      expect(detectKind("Problem Set 3")).toBe("assignment");
      expect(detectKind("Lab Report 1")).toBe("assignment");
    });

    it("detects exams", () => {
      expect(detectKind("Midterm Exam")).toBe("exam");
      expect(detectKind("Final Test")).toBe("exam");
      expect(detectKind("Pop Quiz 1")).toBe("exam");
    });

    it("defaults to lecture", () => {
      expect(detectKind("Week 1: Introduction to Machine Learning")).toBe("lecture");
      expect(detectKind("Chapter 4: Vectors")).toBe("lecture");
    });
  });

  describe("stripPrefix", () => {
    it("strips common prefixes", () => {
      expect(stripPrefix("Week 1: Intro")).toBe("Intro");
      expect(stripPrefix("1. Intro")).toBe("Intro");
      expect(stripPrefix("- Intro")).toBe("Intro");
      expect(stripPrefix("• Intro")).toBe("Intro");
      expect(stripPrefix("1.2 Intro")).toBe("Intro");
      expect(stripPrefix("Intro")).toBe("Intro");
    });
  });

  describe("parseSyllabus", () => {
    it("parses a full syllabus string correctly", () => {
      const text = `
Week 1: Introduction
Week 2: Neural Networks
Assignment 1: Backprop
Midterm Exam
      `;
      const result = parseSyllabus(text);
      expect(result).toEqual([
        { title: "Introduction", kind: "lecture" },
        { title: "Neural Networks", kind: "lecture" },
        { title: "Backprop", kind: "assignment" },
        { title: "Midterm Exam", kind: "exam" },
      ]);
    });

    it("ignores empty lines", () => {
      const result = parseSyllabus("\nLecture 1\n\n\nHW1\n");
      expect(result.length).toBe(2);
      expect(result[0]?.kind).toBe("lecture");
      expect(result[1]?.kind).toBe("assignment");
    });
  });
});
