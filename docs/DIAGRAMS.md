# AlphaSeekers — Architecture Diagrams

Every Mermaid diagram from [`ARCHITECTURE.md`](./ARCHITECTURE.md) collected in one
place for quick reference. Each renders on any Mermaid-aware viewer (GitHub,
VS Code, mermaid.live).

Contents:

1. [C4 L1 — System context](#1-c4-l1--system-context)
2. [C4 L2 — Containers](#2-c4-l2--containers)
3. [C4 L3 — RBAC / Super-Admin components](#3-c4-l3--rbac--super-admin-components)
4. [Data model — entity relationships](#4-data-model--entity-relationships)
5. [Request lifecycle — sequence](#5-request-lifecycle--sequence)
6. [Three-layer access-control model](#6-three-layer-access-control-model)
7. [Target deployment topology](#7-target-deployment-topology)

---

## 1. C4 L1 — System context

```mermaid
flowchart TB
    student["Student<br/>Afghan / refugee learner"]
    teacher["Teacher<br/>volunteer educator"]
    admin["Staff / Admin<br/>role=ADMIN + accessLevel"]
    superadmin["Super Admin<br/>platform owner"]

    subgraph platform["AlphaSeekers Platform"]
        app["Bilingual EN/Dari education platform<br/>Next.js 14 App Router"]
    end

    neon[("Neon Postgres<br/>+ pgvector")]
    r2["Cloudflare R2<br/>object storage"]
    ai["LLM / embedding providers<br/>Groq · Gemma · HuggingFace"]
    notif["Notification channels<br/>Telegram · Web Push · SMTP/ESP"]
    google["Google OAuth /<br/>Calendar / Meet"]

    student --> app
    teacher --> app
    admin --> app
    superadmin --> app

    app --> neon
    app --> r2
    app --> ai
    app --> notif
    app --> google
```

---

## 2. C4 L2 — Containers

```mermaid
flowchart TB
    subgraph client["Client — browser / PWA"]
        ui["React Server + Client Components<br/>next-intl EN/Dari"]
        sw["Service Worker<br/>Web Push subscription"]
    end

    subgraph render["Render — Node runtime"]
        web["Next.js Web Service<br/>App Router: pages + /api handlers"]
        cron["Render Cron Services<br/>pulse (30 min: reminders · scheduler<br/>ai-prep · worker)<br/>data-retention · kpi-digest"]
    end

    pg[("Neon Postgres<br/>-pooler endpoint<br/>pgvector HNSW index")]
    r2["Cloudflare R2"]
    ai["Groq / Gemma / HF"]
    channels["Telegram · Web Push · SMTP/ESP"]

    ui --> web
    sw --> web
    web --> pg
    web --> r2
    web --> ai
    web --> channels
    cron -->|"Authorization: Bearer CRON_SECRET"| web
```

---

## 3. C4 L3 — RBAC / Super-Admin components

```mermaid
flowchart TB
    subgraph routes["API handlers + Server Components"]
        superapi["/api/super/* — employees · audit"]
        adminapi["/api/admin/* — users · classes · content"]
        superpages["/super/* pages — layout guard"]
    end

    subgraph guards["Guards — src/lib/security/permissions.ts"]
        reqsuper["requireSuperAdmin()"]
        reqperm["requirePermission(module.action)"]
        canfn["can() / isSuper()"]
    end

    getac["getAccessControl()<br/>live DB read per request"]
    build["buildAccessControl()<br/>role + accessLevel + permissions"]

    subgraph catalog["Pure catalog — client-safe, no IO"]
        cat["permission-catalog.ts<br/>PERMISSION_MODULES · ACCESS_LEVELS<br/>permissionsForLevel()"]
    end

    store["super-store.ts<br/>employee provisioning · KPIs"]
    audit["audit.ts<br/>recordAudit / listAuditLog"]
    session["session.ts — getSessionUser (JWT)"]
    db[("Postgres User row<br/>role · accessLevel · permissions<br/>deactivatedAt · mustChangePassword")]

    superapi --> reqsuper
    adminapi --> reqperm
    superpages --> canfn
    reqsuper --> getac
    reqperm --> getac
    canfn --> getac
    getac --> session
    getac --> db
    getac --> build
    build --> cat
    superapi --> store
    superapi --> audit
    store --> cat
    store --> db
    audit --> db
```

---

## 4. Data model — entity relationships

```mermaid
erDiagram
    User ||--o{ Class : "teaches"
    User ||--o{ Enrollment : "enrolls"
    User ||--o{ Attendance : "attends"
    User ||--o{ Notification : "receives"
    User ||--o{ AIInteraction : "asks"
    User ||--o{ StudentPost : "authors"
    Class ||--o{ Session : "has"
    Class ||--o{ Enrollment : "roster"
    Session ||--o{ Attendance : "records"

    User {
        string id PK
        string email UK
        UserRole role
        string accessLevel "staff tier; null = legacy admin"
        json permissions "module.action grants"
        datetime deactivatedAt "immediate deactivation"
        boolean mustChangePassword
        datetime approvedAt
    }
    Class {
        string id PK
        string teacherId FK
        int maxStudents
        ClassStatus status
    }
    Session {
        string id PK
        string classId FK
        datetime startTime
        string checkinCode "second-layer attendance proof"
    }
    Enrollment {
        string id PK
        string studentId FK
        string classId FK
        EnrollmentStatus status
    }
    Attendance {
        string id PK
        string sessionId FK
        string studentId FK
        boolean attended
        boolean checkinVerified
    }
    Notification {
        string id PK
        string userId FK
        string dedupeKey "unique with channel"
        NotificationChannel channel
        NotificationStatus status
    }
    AIInteraction {
        string id PK
        string userId FK
        string provider "groq / gemma / cache"
        int responseMs
    }
    StudentPost {
        string id PK
        string authorId FK
        string slug UK
        string status "draft / pending_review / published"
    }
    AuditLog {
        string id PK
        string actorId "not FK-constrained by design"
        string action
        string targetType
        string targetId
    }
```

---

## 5. Request lifecycle — sequence

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant MW as middleware (next-intl)
    participant R as API Route Handler
    participant G as requirePermission()
    participant AC as getAccessControl()
    participant S as getSessionUser (JWT)
    participant DB as Postgres User row
    participant ST as store / db-store

    B->>MW: request /en/... or /api/...
    MW->>MW: locale routing (api/_next excluded)
    MW->>R: forward
    R->>G: requirePermission("users.approve")
    G->>AC: getAccessControl()
    AC->>S: read verified JWT claims
    S-->>AC: {id, role, approved} or null
    AC->>DB: SELECT role, accessLevel, permissions, deactivatedAt
    DB-->>AC: live row
    AC->>AC: buildAccessControl() then can()
    alt authorized
        AC-->>G: AccessControl
        G-->>R: pass
        R->>ST: data operation
        ST->>DB: query / transaction
        DB-->>ST: rows
        ST-->>R: result
        R-->>B: 200 JSON
    else denied
        G-->>R: throw AccessError(401 / 403)
        R-->>B: 401 / 403
    end
```

---

## 6. Three-layer access-control model

```mermaid
flowchart TB
    subgraph L1["Layer 1 — role (UserRole enum, stable coarse tier)"]
        r1["STUDENT"]
        r2["TEACHER"]
        r3["ADMIN"]
    end
    subgraph L2["Layer 2 — accessLevel (staff tier, only meaningful on role=ADMIN)"]
        a0["null = legacy admin<br/>UNRESTRICTED"]
        a1["SUPER_ADMIN"]
        a2["ADMIN"]
        a3["CONTENT_MANAGER"]
        a4["FINANCE"]
        a5["MODERATOR"]
        a6["SUPPORT"]
    end
    subgraph L3["Layer 3 — permissions (module.action grants)"]
        p1["users.view / users.approve"]
        p2["classes.edit"]
        p3["content.moderate"]
        p4["system.employees — super only"]
    end

    r3 --> a1 & a2 & a3 & a4 & a5 & a6
    r3 -.legacy.-> a0
    a1 --> p4
    a3 --> p2
    a3 --> p3
    a6 --> p1
```

---

## 7. Target deployment topology

```mermaid
flowchart TB
    users["500–1000 concurrent users<br/>10k registered students"]

    subgraph render["Render — paid tier"]
        lb["Load balancer"]
        web1["Web Standard instance 1"]
        web2["Web Standard instance 2 — Target"]
        worker["Background Worker<br/>notification fan-out — Target"]
        crons["Cron services<br/>pulse (30 min)<br/>data-retention / kpi-digest"]
    end

    subgraph neon["Neon — paid"]
        pooler["-pooler endpoint<br/>PgBouncer + connection_limit"]
        pg[("Postgres + pgvector")]
    end

    esp["Transactional ESP<br/>SES / Postmark / Resend — Target"]
    r2["Cloudflare R2"]
    ai["Groq / Gemma / HF"]

    users --> lb
    lb --> web1 & web2
    web1 & web2 --> pooler
    worker --> pooler
    crons --> web1
    pooler --> pg
    worker --> esp
    web1 & web2 --> r2
    web1 & web2 --> ai
```
