# AI Task Manager

A local-first Windows desktop task manager with an AI assistant.
Organize tasks, track progress, get deadline reminders, and use natural
language to ask the assistant to create or manage tasks.

> **Testing note:** This project is actively developed. Please report
> bugs with the steps you took, what you expected to happen, and what
> actually happened.

## Features

-   **Task management:** Create, view, edit, complete, and delete tasks.
-   **AI assistant:** Describe tasks in natural language and ask the
    assistant to help manage your task list.
-   **Multiple task creation:** Ask the assistant to create several
    tasks in one request.
-   **AI task actions:** The assistant can create tasks, update task
    status, and request confirmation before deleting a task.
-   **Dashboard:** See a summary of your tasks and progress.
-   **Schedule and reminders:** Track task deadlines and receive in-app
    reminders and Windows notifications.
-   **Snooze reminders:** Snooze a reminder for 15 minutes.
-   **Analytics:** Review completion trends, overdue tasks, and task
    categories.
-   **Personalization:** Adjust supported preferences in Settings.
-   **Data export:** Export task data as JSON from Settings.

## Requirements

-   A Windows computer.
-   An internet connection for AI assistant features.
-   Your own Google Gemini API key to use the AI assistant.

The app is designed to store task data locally on your computer. AI
requests require an internet connection and are sent to Google's Gemini
service. Do not enter sensitive or confidential information into tasks
or AI prompts while testing.

## Install and launch

1.  Download the latest Windows installer
    (`AI Task Manager_..._x64-setup.exe`) from the project's GitHub
    Releases page, if a release is available.
2.  Run the installer and follow the prompts.
3.  Open **AI Task Manager** from the Start menu or the installed
    application shortcut.
4.  If Windows displays a security warning, note that the current
    installer may be unsigned. Only proceed if you trust the source and
    have obtained the installer from the project's official repository
    or release page.

If no installer release is available, ask the project owner for the
current testing build. The app is a Windows desktop application; it is
not currently a hosted web app.

## First-time setup

1.  Open **Settings** in the app.
2.  Find the AI/Gemini API key setting.
3.  Create a Gemini API key through [Google AI
    Studio](https://aistudio.google.com/apikey), then enter it in the
    app's API-key field.
4.  Save the setting and open **AI Assistant** to test a prompt.

Keep your API key private. Do not post it in screenshots, bug reports,
chat messages, or source code. Google may apply usage limits or charges
depending on your account and current terms. AI responses require
internet access and may fail temporarily because of connectivity,
service availability, rate limits, or quota restrictions.

## How to use the app

### 1. Create and manage tasks

1.  Open **Tasks**.
2.  Create a task and provide its title and any available details, such
    as a due date or category.
3.  Update its status as you work: **To do**, **In progress**, or
    **Done**.
4.  Edit or delete tasks when needed.

### 2. Use the AI assistant

1.  Open **AI Assistant**.
2.  Enter a clear request, such as:
    -   `Create a task called "Review my notes".`
    -   `Create five tasks to help me prepare for an exam.`
    -   `Show me what I should work on next.`
    -   `Mark "Review my notes" as done.`
3.  Review the assistant's reply and check the Tasks page to confirm
    that any requested changes occurred.
4.  If you request a deletion, check the confirmation step before
    approving it.

For the best test results, use specific task names and verify the actual
task list after each AI action. AI output can be incorrect, so do not
assume a task was changed unless the app confirms it and the change is
visible.

### 3. Test deadlines and notifications

1.  Create a task with a due date/time using the fields available in the
    app.
2.  Open **Schedule** and check that the task appears as expected.
3.  Test reminders while the app is running. Allow Windows notifications
    for the app if Windows asks.
4.  When a reminder appears, test dismissing it and using the
    **15-minute snooze** option, where available.

Notification delivery can depend on Windows notification settings.
Reminder dismissal and snooze state are currently held in memory for the
app session and may not persist after restarting the app.

### 4. Explore the dashboard and analytics

-   Open **Dashboard** to review the task overview.
-   Open **Analytics** to inspect completion information, trends,
    overdue tasks, and categories.
-   Change supported preferences in **Settings** and check whether the
    app reflects them.

### 5. Test data export

1.  Open **Settings**.
2.  Use the JSON export option.
3.  Save the exported file somewhere safe and confirm that it contains
    the expected data.
4.  Do not include exported personal data in a public bug report.

The API key is stored separately from the task database and should not
be included in a task-data export. JSON import/restore is not currently
documented as a supported feature.

## Suggested tester checklist

Please try these scenarios and report any failures:

-   [ ] Install and launch the app.
-   [ ] Create a task, edit it, change its status, and delete a test
    task.
-   [ ] Close and reopen the app; confirm that saved tasks remain.
-   [ ] Ask the AI assistant to create one task.
-   [ ] Ask the AI assistant to create three to five tasks in one
    request.
-   [ ] Ask the assistant to change a task's status.
-   [ ] Test the deletion confirmation flow without deleting anything
    you need.
-   [ ] Set a deadline and check the Schedule page.
-   [ ] Test an in-app reminder, Windows notification, dismissal, and
    snooze.
-   [ ] Review Dashboard and Analytics.
-   [ ] Change a preference in Settings.
-   [ ] Export task data to JSON.

Use disposable test tasks and avoid entering passwords, API keys,
financial details, health information, or other sensitive data into task
descriptions or AI prompts.

## Troubleshooting

**The AI assistant does not respond** - Check your internet
connection. - Confirm that the Gemini API key is entered correctly in
Settings. - Check whether the API key has quota or usage restrictions. -
Retry later if Google's service is temporarily unavailable.

**Windows notifications do not appear** - Check Windows notification
settings and whether notifications are enabled for the app. - Keep in
mind that Windows may suppress notifications under certain system
settings.

**The app behaves unexpectedly** - Retry once and note whether the issue
is repeatable. - Record the steps, expected result, actual result, and
any error message. - Include your Windows version and the app version if
available. - Redact API keys, personal information, and private task
content from screenshots or logs.

## Reporting feedback or bugs

Please report issues through the project's GitHub Issues page, if
enabled, or send feedback directly to the project owner.

A useful bug report includes:

-   **App version / Windows version**
-   **Steps to reproduce**
-   **Expected result**
-   **Actual result**
-   **Error message or screenshot** (with secrets and personal data
    removed)
-   **Whether the issue happens every time**

## Privacy and limitations

-   Task data is designed to be stored locally in the app's SQLite
    database.
-   AI assistant requests are sent to Google's Gemini service, so AI use
    is not fully offline.
-   The app currently targets Windows desktop use.
-   The installer may be unsigned.
-   AI availability depends on network connectivity and the external AI
    service.
-   This is a testing build; back up important data before experimenting
    and use non-sensitive sample tasks.

## Project

-   **Repository:** https://github.com/kaelcodes/ai-task-manager
-   **Portfolio:** https://kaelcodes.github.io/Portfolio/
