# Design

## UX flow
- Library landing: smart views (recent, favorites, most used)
- Filters: type, scope, tags, collections
- Asset detail: preview, metadata, license, usage, export
- Insert asset into editor + create variant

## Content model
- Asset core: id, type, scope, owner, createdAt, updatedAt
- Metadata: title, description, tags, license, attribution
- Media: file refs (image/SVG), or snippet ref + props schema
- Collections: id, name, scope, items
- Favorites: userId + assetId
- Versions: assetId, version, changelog, createdAt

## Data bindings
- Tags are global within org; assets reference tags by id
- Collections are scoped; items ordered
- Snippet props validated against JSON schema
- Search index includes title, tags, type, scope, owner

## Accessibility considerations
- Keyboard navigation for filters and asset grid
- Visible focus states for cards and controls
- Text alternatives for image/SVG previews

## Design risks
- Overwhelming navigation without strong defaults
- Metadata bloat slows asset creation
- Permission cues unclear between org/event/personal
