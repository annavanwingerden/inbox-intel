# 📄 Spec.md

## 🏷 Project Name
**InboxIntel – Cold Outreach Campaign Mode**

---

## 🧠 Overview

InboxIntel is a cold outreach tool that helps users craft, send, and improve their cold email campaigns. It uses OpenAI to optimize email content, the Gmail API to send and track replies, Supabase as the backend (without requiring dashboard access), Comet Opik to evaluate and trace prompt effectiveness, and the aci-mcp-unified MCP server to automate Github-based CI/CD and deployment to Vercel.

---

## 🎯 Core Features (MVP)

### 1. 🗂 Campaign Management
- Create and manage named cold outreach campaigns.
- Define a clear goal (e.g., "Book 10 meetings", "Get feedback on MVP").
- Add a target audience description (e.g., "Early-stage founders on LinkedIn").

### 2. ✍️ Email Writing & Optimization
- Input an initial cold email draft OR generate one based on campaign goal.
- Use OpenAI to improve the email's tone, clarity, or personalization.
- Store prompt version and final output in Supabase.
- Log prompt metadata and evaluation to Comet Opik.

### 3. 🔐 Auth via Supabase (Google Sign-In)
- Users log in via Supabase Auth (Google).
- Authentication and session handled client-side using the `anon` API key.
- All campaign and email data is associated with their user ID.

### 4. 📤 Email Sending via Gmail API
- Users connect Gmail via OAuth.
- Email is sent using Gmail API (`users.messages.send`).
- Message metadata (`messageId`, `threadId`) saved in Supabase.

### 5. 📥 Automatic Reply Tracking
- Replies detected by polling Gmail API (`users.threads.list`).
- Matches based on `threadId` or `In-Reply-To` header.
- Replies automatically logged with timestamps.
- Emails marked as "Replied" or "No response".

### 6. 🧠 Manual Outcome Tagging
- Users can label responses:
  - ✅ Positive reply
  - ❌ Not interested
  - 🤔 Maybe later
- Add free-text notes for later reference (e.g., "Asked to follow up next month").

### 7. 💬 Follow-up Email Support
- View full message thread for each contact.
- Generate follow-up email using OpenAI, based on user notes + previous reply.
- Send follow-up in Gmail thread (`threadId`) using Gmail API.

### 8. 📊 Analytics Dashboard
- Show campaign stats:
  - Emails sent
  - Replies received
  - Reply rate (%)
- Show prompt-level metrics (Comet Opik):
  - Prompt versions and their response rates
  - Sentiment, readability, and tone analysis
- Suggestions for top-performing prompt variants

### 9. 🚀 Aci-mcp-unified CI/CD Automation
- Deployment is handled by aci-mcp-unified MCP server
- All code lives in a Github repo.
- Git push triggers CI → auto-deploy to Vercel frontend.
- Supabase Edge Functions auto-deployed if added to repo.
- No Supabase UI needed — all backend logic lives in code.

---

## 🧱 Architecture Overview

| Component       | Technology                    |
|------------------|-------------------------------|
| Frontend         | Next.js (App Router), Tailwind, Shadcn UI |
| Auth             | Supabase Auth (Google OAuth)  |
| Backend DB       | Supabase PostgreSQL (via SQL) |
| Server Logic     | Supabase Edge Functions (TypeScript) |
| Email API        | Gmail API (OAuth2)            |
| LLM              | OpenAI API (GPT-4)            |
| Prompt Logging   | Comet Opik                    |
| Deployment       | Github → Vercel (via aci-mcp-unified) |

---

## 🗃 Data Models

### `campaigns`
```sql
id UUID PRIMARY KEY,
user_id UUID,
name TEXT,
goal TEXT,
audience TEXT,
created_at TIMESTAMP DEFAULT now()
```

### `emails`
```sql
id UUID PRIMARY KEY,
campaign_id UUID REFERENCES campaigns(id),
user_id UUID,
recipient_email TEXT,
subject TEXT,
original_draft TEXT,
optimized_content TEXT,
message_id TEXT, -- Gmail API messageId
thread_id TEXT, -- Gmail API threadId
status TEXT DEFAULT 'sent', -- 'sent', 'replied', 'no_response'
sent_at TIMESTAMP DEFAULT now(),
created_at TIMESTAMP DEFAULT now(),
updated_at TIMESTAMP DEFAULT now()
```

### `replies`
```sql
id UUID PRIMARY KEY,
email_id UUID REFERENCES emails(id),
user_id UUID,
thread_id TEXT, -- Can be used to link to the original email thread
in_reply_to_message_id TEXT, -- If it's a direct reply to a specific message
content TEXT,
received_at TIMESTAMP DEFAULT now(),
outcome_tag TEXT, -- 'positive', 'not_interested', 'maybe_later', null
notes TEXT,
created_at TIMESTAMP DEFAULT now()
```

---

## 👨‍💻 User Stories

To understand the system from the user's perspective, here are some key user stories:

### Campaign Management
-   **As a user, I want to create a new cold outreach campaign** so that I can organize my outreach efforts around a specific goal and target audience.
    -   *Acceptance Criteria:* I can give my campaign a name, define its goal (e.g., "Book 10 meetings"), and describe my target audience (e.g., "Early-stage founders on LinkedIn").

### Email Writing & Optimization
-   **As a user, I want to work with the AI agent to create a killer cold email** for my outreach message
    -   *Acceptance Criteria:* I can chat with the AI agent, view the suggested changes, and save the optimized version.

### Email Sending & Reply Tracking
-   **As a user, I want to send personalized emails to my target audience** so that I can initiate my cold outreach campaign.
    -   *Acceptance Criteria:* I can connect my Gmail account, select an optimized email, specify recipients, and send the emails via the Gmail API.
-   **As a user, I want the system to automatically track replies to my sent emails** so that I don't have to manually monitor my inbox.
    -   *Acceptance Criteria:* The system will detect replies via the Gmail API, associate them with the original email thread, and update the email's status with both of Replied/ No Reply - and also intent detection such as "Postive reply", "Not Interested" etc.

### Follow-ups
-   **As a user, I want to send follow-up emails based on previous interactions** so that I can continue the conversation with promising leads or re-engage others.
    -   *Acceptance Criteria:* I can view the full email thread, generate a follow-up email using AI based on the context and my notes, and send it within the same thread.

---

## ⚙️ Non-Functional Requirements (NFRs)

These requirements specify criteria that can be used to judge the operation of a system, rather than specific behaviors.

### 1. Security
-   **Authentication:** All user authentication must be handled securely via Supabase Auth with Google Sign-In (OAuth 2.0).
-   **Authorization:** Data access must be strictly limited to the `user_id` associated with the authenticated user. Users should only be able to view and manage their own campaigns, emails, and replies.
-   **API Key Management:** All API keys (OpenAI, Gmail, Comet Opik, Supabase `anon` key) must be handled securely, preferably via environment variables and server-side logic (Supabase Edge Functions) where applicable, to prevent client-side exposure.
-   **Data Encryption:** All sensitive data (e.g., email content, recipient information) stored in Supabase must be encrypted at rest. Data in transit (between client, Supabase, Gmail API, OpenAI API) must use TLS/SSL.
-   **OAuth Token Storage:** Gmail OAuth tokens must be securely stored and refreshed.

### 2. Performance
-   **API Response Times:** Frontend interactions with Supabase Edge Functions and external APIs (OpenAI, Gmail) should aim for response times under 500ms for common operations (e.g., loading campaigns, sending a single email, generating email draft).
-   **Scalability:** The architecture should support scaling to thousands of users and concurrent email sending/tracking operations. Supabase and Vercel are expected to handle this scaling.
-   **Gmail Polling:** The frequency of Gmail API polling for replies should be optimized to balance timely detection with API rate limits and resource usage. (e.g., every 5-10 minutes per active campaign).

### 3. Reliability & Error Handling
-   **API Integration Robustness:** The system must gracefully handle failures from external APIs (OpenAI, Gmail). This includes:
    -   Retries for transient errors.
    -   Clear error messages to the user for persistent failures.
    -   Logging of API errors for debugging.
-   **Data Consistency:** Ensure atomicity for critical operations (e.g., sending an email and saving its metadata). Use Supabase transactions where necessary.
-   **Input Validation:** All user inputs must be validated on both the client and server (Supabase Edge Functions) to prevent invalid data and security vulnerabilities.
-   **Logging & Monitoring:** Implement comprehensive logging for application events, errors, and performance metrics. Utilize Comet Opik for prompt-related tracing and evaluation, and establish general logging for the rest of the application.

### 4. Usability (UX implicitly covered by Shadcn UI)
-   **Intuitive Interface:** The UI should be clean, responsive, and easy to navigate, consistent with modern web application standards (leveraging Shadcn UI components).
-   **Clear Feedback:** Users should receive clear visual feedback for their actions (e.g., success messages, loading indicators, error notifications).

### 5. Maintainability & Extensibility
-   **Code Quality:** Adhere to best practices for code quality, including clear variable naming, modular design, and comprehensive comments for complex logic.
-   **Testability:** Code should be written with testability in mind, enabling easy unit, integration, and end-to-end testing.
-   **Configuration:** External service endpoints, API keys, and other environment-specific settings should be configurable via environment variables.

---

## 🖥️ UI/UX Considerations

While detailed mockups are separate, the following general principles apply:
-   **Responsiveness:** The application should be fully responsive and provide an optimal experience across various devices (desktop, tablet, mobile).
-   **Consistency:** Maintain a consistent visual design language and interaction patterns throughout the application, utilizing Tailwind CSS and Shadcn UI components.
-   **Accessibility:** Adhere to WCAG guidelines where feasible to ensure the application is usable by individuals with disabilities.

### User Flow (High-Level)
-   **Onboarding:** User lands on the application, signs in via Google (Supabase Auth). If new, they are guided to create their first campaign.
-   **Campaign Creation:** User navigates to the "New Campaign" section, inputs campaign name, goal, and audience description. Upon saving, they are redirected to the campaign's dashboard.
-   **Email Draft & Send:** From a campaign dashboard, the user can initiate drafting a new email. They can input content or use AI to generate it. Once satisfied, they can select recipients and trigger sending. After sending, the system provides feedback and updates the email status.
-   **Reply Management:** Users can view replies associated with their campaigns. They can tag outcomes and add notes. They can also initiate follow-up emails from the thread view.
-   **Analytics View:** User can navigate to an analytics dashboard to view overall campaign performance and prompt-level metrics.

---

## 🛠️ Technical Constraints & Assumptions

-   **Next.js/npm:** Development environment assumes Next.js and npm as the package manager.
-   **TypeScript:** All backend (Edge Functions) and frontend code will be written in TypeScript.
-   **Supabase Client Libraries:** Use the official Supabase client libraries for interacting with the Supabase backend.
-   **Gmail API Client:** Use a suitable client library for interacting with the Gmail API.
-   **OpenAI API Client:** Use the official OpenAI client library.
-   **Comet Opik SDK:** Integrate Comet Opik using their provided SDK for prompt logging.
-   **Github CI/CD:** CI/CD processes will be managed through aci-mcp-unified MCP server.
-   **Vercel Deployment:** Frontend deployment will be managed through Vercel.
-   **Supabase Edge Functions:** All server-side business logic and API integrations will reside within Supabase Edge Functions. No traditional backend server will be deployed separately.
-   **No Supabase Dashboard Access (for core logic):** All database schema migrations, RLS policies, and function deployments should be code-driven and managed via the Github repository, not manual intervention in the Supabase dashboard.

### Environment Variables
-   All sensitive API keys (OpenAI, Gmail, Supabase `anon` key) and external service URLs must be configured as environment variables. For local development, a `.env.local` file should be used. For Vercel deployment, these will be set as Vercel environment variables. Supabase Edge Functions will have their secrets configured directly within Supabase.

### Supabase Row Level Security (RLS)
-   All Supabase tables (`campaigns`, `emails`, `replies`) must have RLS policies enabled. Policies should ensure that users can only access rows where `user_id` matches their authenticated `auth.uid()`. This is critical for data isolation and security.

### API Rate Limits & Quotas
-   The application must consider and handle rate limits for external APIs (Gmail API, OpenAI API). This may involve:
    -   Implementing client-side and server-side rate limiting where applicable.
    -   Using exponential backoff for API retries.
    -   Monitoring API usage to stay within quotas.
-   For Gmail API, be mindful of daily quotas for sending emails and polling. Implement strategies to queue emails or replies if limits are approached.

### Error Handling Strategy
-   **Frontend:** Display user-friendly error messages for API failures or invalid inputs. Use toast notifications or inline error messages. Log client-side errors to the console or a monitoring service.
-   **Supabase Edge Functions:** Implement robust `try-catch` blocks for all external API calls and database operations. Return standardized error responses to the frontend. Log detailed error information (stack traces, request payloads) to a logging service.
-   **Database Errors:** Handle Supabase database errors gracefully, providing meaningful feedback to the user when possible (e.g., duplicate campaign name).

---

## 🔮 Future Enhancements (Beyond MVP)

The following features are planned for future iterations but are out of scope for the initial MVP:

-   **Multi-channel Outreach:** Integration with other platforms like LinkedIn, Twitter DMs.
-   **Advanced Analytics:** More sophisticated reporting, custom dashboards, predictive analytics.
-   **Team Collaboration:** Ability for multiple users to collaborate on campaigns.
-   **A/B Testing:** Tools for A/B testing different email variants or subject lines.
-   **Email Template Library:** Pre-built, customizable email templates.
-   **Custom Domains:** Ability to send emails from custom verified domains.
-   **CRM Integration:** Syncing contacts and campaign data with popular CRM systems.
-   **Scheduling & Drip Campaigns:** Advanced scheduling features and automated drip sequences.
-   **Webhooks for Reply Detection:** Instead of polling, leverage webhooks for real-time reply detection if Gmail API supports it for our use case.

---

## 🧪 Testing Strategy

A multi-faceted testing approach will be adopted to ensure the quality and reliability of the InboxIntel application.

### 1. Unit Tests
-   **Scope:** Individual functions, components, and utility modules.
-   **Frameworks:** Jest or Vitest for TypeScript/JavaScript code.
-   **Focus:** Testing business logic in isolation, ensuring functions produce expected outputs for given inputs.
-   **Coverage:** Aim for high code coverage, especially for critical logic within Supabase Edge Functions and frontend data manipulation.

### 2. Integration Tests
-   **Scope:** Interactions between different modules, components, and external services.
-   **Focus:** Verifying the correct flow of data between frontend and Edge Functions, and Edge Functions with Supabase and external APIs (OpenAI, Gmail).
-   **Mocking:** Use mocking for external APIs during testing to ensure deterministic results and avoid hitting rate limits or incurring costs.
-   **Supabase:** Integration tests for Supabase Edge Functions interacting with the database should be run against a test database instance or use Supabase's local development tools.

### 3. End-to-End (E2E) Tests
-   **Scope:** Full user journeys through the application, simulating real user interactions.
-   **Frameworks:** Playwright or Cypress.
-   **Focus:** Validating the entire system from the UI down to the database and external API interactions.
-   **Authentication:** E2E tests should handle Supabase Google OAuth flow or simulate authenticated sessions for testing protected routes.

### 4. Manual Testing / QA
-   **Scope:** Exploratory testing, usability, and visual regression testing.
-   **Focus:** Catching edge cases, verifying UX/UI consistency, and ensuring the application meets user expectations.
-   **Browser Compatibility:** Test across major browsers (Chrome, Firefox, Edge, Safari).
-   **Mobile Responsiveness:** Verify layout and functionality on various mobile devices and screen sizes.

### 5. Performance Testing
-   **Scope:** Load testing for Supabase Edge Functions and database queries.
-   **Focus:** Identifying bottlenecks and ensuring the application performs well under anticipated user load.

---

## 🚀 Deployment & Operations

-   **Frontend (Next.js):** Deployed to Vercel via automated CI/CD triggered by Git pushes to the main branch of the Github repository via aci-mcp-unified.
-   **Supabase Edge Functions:** Deployed automatically when changes are pushed to the relevant directory in the Github repository (configured via aci-mcp-unified).
-   **Supabase Database:** Schema migrations and RLS policies are applied through code-driven migrations within the Github repository, synchronized with Supabase via aci-mcp-unified. No manual dashboard intervention for core schema changes.
-   **Monitoring:** Utilize Vercel's built-in logging and analytics for frontend, Supabase's logs for database and Edge Functions, and Comet Opik for LLM prompt tracing. Establish alert mechanisms for critical errors and performance deviations.
-   **Rollbacks:** CI/CD should support easy rollbacks to previous stable versions in case of deployment issues.

When deploying - it is recommended to add this input at the start of your convo:
"You are a helpful assistant with access to a unlimited number of tools via two meta functions:
- ACI_SEARCH_FUNCTIONS
- ACI_EXECUTE_FUNCTION

You can use ACI_SEARCH_FUNCTIONS to find relevant, executable functionss that can help you with your task.
Once you have identified the function you need to use, you can use ACI_EXECUTE_FUNCTION to execute the function provided you have the correct input arguments."

