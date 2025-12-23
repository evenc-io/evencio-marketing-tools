# Overview

## Problem
Organizers need a professional, flexible library of marketing assets. Today assets are mostly static images; we also want code-driven designs (React/HTML) that can be rendered/exported like images, but remain editable and reusable.

## Goal
Define a library structure and content model that supports images, SVG, and code snippets, organized across global/org/event/personal scopes with tagging, collections, and favorites.

## MVP deliverables
- Library data model for assets, tags, collections, favorites, and scopes
- Minimal library IA (navigation + smart views) that supports search/filter
- Deterministic render pipeline for code snippets to PNG
- Asset import flow for images/SVGs and snippet registration

## Non-goals
- Implementing the full UI or runtime rendering engine
- Building a full permissions system
- Shipping every export format in the first release

## Target users
- Event organizers and marketing teams
- Designers who manage reusable templates
- OSS contributors building shared assets

## Asset types (MVP)
- Image (PNG/JPEG)
- SVG
- Code snippet (React/HTML)

## Scopes
- Global: shared OSS assets
- Org: team-approved assets for a company/org
- Event: assets tailored to a specific event
- Personal: private drafts and experiments

## Primary workflows
- Browse/search/filter assets by type, scope, and tags
- Create/import assets and add metadata/licensing
- Reuse assets in the editor and export to PNG for event pages
- Promote or copy assets between scopes (e.g., personal → event → org)

## Assumptions
- Assets can be rendered to PNG for event pages
- Code snippets are React/HTML components with a defined prop schema
- Library needs to work for OSS and business orgs

## Constraints (MVP)
- Deterministic rendering: fixed viewport, fonts, time, and locale
- No external network access in snippet runtime
- Restrict imports to approved internal packages

## Dependencies
- Editor canvas and export pipeline
- Component registry and asset storage
- Auth/organization model (for org/event scopes)
- Sandbox execution environment for snippets

## Open questions
- How to safely sandbox code snippets
- Licensing and attribution for shared assets
- Versioning strategy for reusable components

## Milestones
- Define content model and metadata
- Define library information architecture and scopes
- MVP library with 1-2 example kits
- Export pipeline for code snippets to PNG
