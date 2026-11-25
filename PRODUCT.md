# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Docentes** of the Escuela de Aviación del Ejército: at the start of a class they pick their session and take attendance by pointing the camera at each student, on a laptop webcam or a tablet/phone at the classroom door. They work standing, in a hurry, in an ordinary classroom under fluorescent/daylight.
- **Administrador**: maintains students, teachers and groups, enrolls student faces, and reviews attendance history.
- **Evaluador (profesor de Programación I)**: watches a live demo of every rubric criterion; the interface must make each function easy to find and explain.

## Product Purpose

Web app that calls the roll by facial recognition. Every attendance record is tied to one student, one teacher and one class session. Success: attendance registered in seconds per student, no duplicates, unknown faces clearly flagged, and history consultable by date.

## Positioning

University exam project (Programación I, final). Value is correctness, clarity and a smooth demo, not commercial differentiation.

## Operating Context

- Demo script (fixed by the exam): admin login → pick teacher → schedule class → register an enrolled volunteer → repeat capture (duplicate warning) → unenrolled face (unknown warning) → query attendance by date → additional function (CSV export with absences, manual correction with reason).
- Runs in the browser on Vercel with Supabase; needs internet and camera permission (HTTPS).
- Used on both laptop and tablet/phone; the attendance screen must work one-handed on a tablet.

## Capabilities and Constraints

- Roles: admin (account listed in `public.cuenta`) and docente (account whose email matches an active teacher). Admin module restricted to admin.
- Face recognition runs in the browser (face-api); only a 128-number descriptor is sent; matching happens in Postgres (pgvector).
- Deactivate instead of delete for students and teachers.
- Interface language: Spanish (Colombia), timezone America/Bogotá.
- Only fictitious data and authorized volunteers' faces.

## Brand Commitments

- Neutral: no institutional shield, emblems or military insignia. Generic app name.
- User constraint: **no colored borders** anywhere in the UI.
- Standing preference (2026-11-25): the category standard played straight — a clean modern product UI at the craft level of Linear and the Vercel dashboard, no visual metaphor.

## Evidence on Hand

- Exam brief: `parcialprogramacion.pdf`. Seed data in `supabase/seed.sql` is fictitious and must stay labeled as such. No real student data, photos or logos.

## Product Principles

1. The attendance moment is the product: camera, verdict and who's already present must read at a glance from arm's length.
2. Every rubric function is reachable in one or two clicks from the navigation.
3. Errors name the problem and the fix, in plain Spanish.
4. Nothing destructive: deactivate, never delete.
