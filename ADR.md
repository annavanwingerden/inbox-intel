# Architecture Decision Record (ADR) - InboxIntel

## 1. Context

This document outlines the architectural decisions for **InboxIntel**, a cold outreach tool built on a modern serverless stack. The goal is to create a Minimum Viable Product (MVP) that is robust, scalable, and can be developed within a very short timeframe (a few hours).

The system's core requirements, as defined in `SPEC.md`, include campaign management, AI-assisted email authoring, sending emails via the Gmail API, and automatically tracking replies. The specified technology stack is Next.js, Supabase (Auth, Database, Edge Functions), OpenAI, and Vercel.

## 2. Architectural Drivers

The architecture is primarily driven by the following factors:

-   **Speed of Implementation (KISS):** The most critical constraint is the need to build and deploy a functional system in just a few hours. Simplicity is paramount.
-   **Serverless-First:** The architecture must fully leverage the specified serverless and managed services (Vercel, Supabase) to minimize operational overhead.
-   **Clear Separation of Concerns:** A clean division between the frontend (presentation) and backend (business logic) is essential for maintainability and future extensibility.
-   **Scalability:** While an MVP, the design should inherently support scaling as user and data volumes grow, without requiring a significant re-architecture.
-   **Security:** Data isolation between users is non-negotiable and must be enforced at the data layer.

## 3. Architectural Approach & Key Decisions

Here, we'll break down the architecture, exploring options and making decisions based on the drivers above.

### 3.1. Core Component Responsibilities

The system is logically divided into three main components:

-   **Frontend:** A Next.js application responsible for all UI rendering, user interaction, and client-side state. It acts as a thin client, delegating all business logic to the backend.
-   **Backend:** A collection of Supabase Edge Functions that encapsulate all business logic, database interactions, and third-party API calls (Gmail, OpenAI).
-   **Database:** A Supabase PostgreSQL instance that serves as the single source of truth, with security enforced by Row Level Security (RLS) policies.

### 3.2. Decision 1: Backend Logic & API Layer

This is the most fundamental architectural choice: where business logic resides.

-   **Option A: Logic in Next.js Route Handlers:** Perform all database queries and external API calls from Next.js API Routes or Server Actions.
    -   *Reasoning:* This approach co-locates UI and server logic, which can initially feel faster. It reduces the number of distinct services to manage (only Next.js on Vercel).
    -   *Trade-offs:* This blurs the separation of concerns. It makes sharing logic with a future mobile app difficult. All secrets (Gmail, OpenAI, Supabase) would need to be managed in Vercel, and the database would have to be exposed directly to the Vercel environment, which is a less secure pattern than routing through Supabase's dedicated backend functions.

-   **Option B: Logic in Supabase Edge Functions:** The Next.js frontend makes calls to a dedicated API layer built with Supabase Edge Functions. These functions handle all interactions with the database and external services.
    -   *Reasoning:* This creates a clean, secure, and reusable backend API. Secrets are managed within Supabase, closer to where they are used. The frontend is cleanly decoupled. This aligns perfectly with the `SPEC.md` and leverages the full power of the Supabase stack. RLS provides a robust security model as all data access is mediated through the authenticated user's session within Supabase.
    -   *Trade-offs:* Requires a small amount of initial setup to configure the Supabase local dev environment and deploy functions. However, this overhead is minimal and pays dividends in security and maintainability.

-   **Decision:** **Option B - Supabase Edge Functions.** This is the superior choice. It provides a clean, secure, and scalable architecture that aligns with our principles. The "build in hours" constraint is not violated, as the Supabase CLI makes function creation and deployment trivial.

### 3.3. Decision 2: Asynchronous Operations (Reply Tracking)

Tracking email replies is an asynchronous background task.

-   **Option A: Client-Triggered Polling:** The frontend app periodically calls a function to check for replies when the user is active on the page.
    -   *Reasoning:* Simple to implement; no backend scheduling needed.
    -   *Trade-offs:* Ineffective. It doesn't track replies when the user is offline, defeating the purpose of automation. It also creates unnecessary API traffic while a user is idle on the page.

-   **Option B: Scheduled Cron Jobs:** Use a scheduled Supabase Edge Function to poll the Gmail API for all active campaigns.
    -   *Reasoning:* This is a simple, reliable, and purely server-side solution. Using `pg_cron` with Supabase is straightforward to configure. It guarantees that replies are checked periodically, regardless of user activity.
    -   *Trade-offs:* There will be a delay (e.g., 5-10 minutes) in reply detection, which is acceptable for an MVP. It could become inefficient at a massive scale, but it's the perfect starting point.

-   **Option C: Gmail Push Notifications (Webhooks):** A more advanced, real-time approach.
    -   *Reasoning:* Provides instant reply detection and is the most efficient solution in terms of API usage.
    -   *Trade-offs:* Significantly more complex. Requires setting up a dedicated public endpoint, handling Google domain verification, and managing subscription lifecycles. This is a clear violation of the KISS principle and the "build in hours" constraint.

-   **Decision:** **Option B - Scheduled Cron Jobs.** This provides the best balance of simplicity, effectiveness, and rapid implementation for the MVP. It is a robust solution that can be optimized later if needed.

### 3.4. Decision 3: Data Models and Security

-   **Option A: Manual `user_id` checks in every function.** Manually add `WHERE user_id = '...'` to every database query within the Edge Functions.
    -   *Reasoning:* Explicit and easy to see in the code.
    -   *Trade-offs:* Error-prone and repetitive. A developer could easily forget a check, creating a major security hole. Violates the DRY (Don't Repeat Yourself) principle.

-   **Option B: Enforce Authorization at the Database Layer.** Use Supabase's built-in Row Level Security (RLS).
    -   *Reasoning:* This is the canonical approach for Supabase. RLS policies are defined once on each table, ensuring that any query (no matter where it originates) is automatically filtered for the authenticated user (`auth.uid()`). It is secure by default.
    -   *Trade-offs:* Requires writing SQL for the policies. However, these policies are typically simple and boilerplate, providing immense security benefits for minimal effort.

-   **Decision:** **Option B - Row Level Security.** This is non-negotiable for a secure, multi-tenant application. It is the most robust and maintainable way to ensure data isolation. The data models defined in `SPEC.md` are well-suited for this and will be implemented as is, with RLS policies applied to each.

## 4. Final Architecture Summary

The chosen architecture is a **classic three-tier serverless model** that is simple to build and operate.

1.  **Presentation Layer (Frontend):** A **Next.js application** deployed on **Vercel**. It uses Server Components for data fetching and renders the UI with Shadcn components. It is a "thin" client.

2.  **Business Logic Layer (Backend):** A set of **Supabase Edge Functions** that serve as a secure API. Each function handles a specific task (e.g., `send-email`, `get-campaign-analytics`). This layer orchestrates calls to the database and external services like OpenAI and Gmail.

3.  **Data Layer (Database):** A **Supabase PostgreSQL database**. All tables (`campaigns`, `emails`, `replies`) will be protected with **Row Level Security (RLS)** policies to ensure users can only access their own data.

**Interaction Flow Example (Sending an Email):**
1.  User clicks "Send" in the Next.js UI.
2.  The client calls the `invoke` method for the `send-email` Edge Function.
3.  The `send-email` function executes on Supabase's servers.
4.  It validates the request and calls the Gmail API to dispatch the email.
5.  Upon success, it writes the message metadata to the `emails` table in the Supabase DB.
6.  It returns a success response to the client.
7.  The UI displays a "Sent!" notification.

This design directly aligns with our drivers: it's fast to implement using the Supabase CLI and Vercel integration, maintains a clean separation of concerns, and is built on services designed for scalability and security. 