# Teams and roles

[[toc]]

## Introduction

Forms belong to a **workspace**: a shared space for a team, an organisation or a department.
People get access by being **members** of a workspace, each with a **role**. One person can
belong to several workspaces and switch between them from the sidebar.

Every account starts with a workspace of its own. Create more from the workspace switcher.

## Roles

Each role can do everything the role before it can, and more:

| Role | Can |
|---|---|
| **Viewer** | See forms, submissions, reports and files; export CSV |
| **Reviewer** | Also change a submission's status and add notes |
| **Editor** | Also create, edit, publish and duplicate forms; edit and delete submissions; manage webhooks |
| **Admin** | Also delete forms; invite people; change and remove members below admin |
| **Owner** | Also manage admins and rename the workspace |

Each workspace has exactly one owner: the person who created it.

The server enforces these rules on every request. The web app also hides what a role cannot
do, but that is for convenience only.

## Inviting people

From **Team**, an admin or owner enters an email address and a role and sends an
invitation. The person receives a link valid for **seven days**. To accept, they sign in (or
create an account) **with the address the invitation was sent to**, then press Accept.

- Inviting the same address again replaces the earlier invitation.
- Pending invitations are listed on the Team page and can be withdrawn.
- With `REGISTRATION=invite`, the invitation link is the only way for a new person to create
  an account.

Invitations need [email](./email) to be configured.

## Changing roles and removing people

Admins and owners can change the role of, or remove, anyone **below** their own role, and can
only give roles below their own. Nobody can make someone else the owner.

Members can **leave** a workspace themselves, except the owner. Removing or leaving cuts off
access immediately, including any API keys that person created for that workspace.

## API keys

Members can create [API keys](./api#api-keys) under **Account**. A key belongs to one
workspace and can only read, whatever its creator's role.

## Sessions

Signing in lasts 30 days. Changing or resetting a password signs that account out
everywhere else.
