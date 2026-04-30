# AfriXplore — System Architecture

## High-Level Overview

```mermaid
graph TB
    subgraph Users["👥 Users"]
        TU[Traveller / Explorer]
        AU[Admin User]
        SC[Scout - Field Agent]
    end

    subgraph Vercel["☁️ Vercel (Frontend)"]
        PW[platform-web\nNext.js 14]
        AW[admin-web\nNext.js 14]
    end

    subgraph Entra["🔐 Microsoft Entra CIAM"]
        MSAL[MSAL Authentication]
        JWKS[JWKS Endpoint\nRS256 JWT]
    end

    subgraph AzureCA["☁️ Azure Container Apps"]
        IA[intelligence-api\n:3001]
        SA[scout-api\n:3002]
        PS[payment-service\n:3003]
        MA[msim-api\n:3004]
        AI[ai-inference\n:3005]
        GW[geospatial-worker\nBackground]
        NS[notification-service\nService Bus Consumer]
    end

    subgraph AzureData["🗄️ Azure Data"]
        DB[(Azure Database\nPostgreSQL + PostGIS)]
        SB[Service Bus\nTopics + Queues]
        KV[Key Vault\nSecrets]
        ACR[Container Registry]
        MON[App Insights\nMonitoring]
    end

    subgraph External["🌍 External Services"]
        MTN[MTN MoMo\nPayments]
        AT[Africa's Talking\nSMS + USSD]
        ACS[Azure Communication\nServices Email]
    end

    TU -->|HTTPS| PW
    AU -->|HTTPS| AW
    SC -->|USSD/SMS| AT

    PW & AW -->|MSAL loginRedirect| Entra
    PW -->|Bearer JWT| IA
    PW -->|Bearer JWT| PS
    AW -->|Bearer JWT| MA

    SA -->|JWKS verify| JWKS
    IA -->|JWKS verify| JWKS
    PS -->|JWKS verify| JWKS
    MA -->|JWKS verify| JWKS

    PS -->|Collection API| MTN
    SA -->|SMS/USSD| AT
    NS -->|Email| ACS
    NS -->|SMS| AT

    SB -->|Consume| NS
    PS -->|Publish| SB
    IA -->|Publish| SB

    AzureCA -->|Managed Identity| KV
    AzureCA -->|Read/Write| DB
    AzureCA -->|Telemetry| MON
    GW -->|PostGIS queries| DB
    GW -->|ML inference| AI
```

## Authenticated API Call — Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User Browser
    participant PW as platform-web (Vercel)
    participant Entra as Microsoft Entra CIAM
    participant IA as intelligence-api
    participant KV as Key Vault
    participant DB as Azure Database (PostGIS)

    U->>PW: Navigate to protected page
    PW->>PW: Check MSAL token cache (sessionStorage)
    alt No token or expired
        PW->>Entra: loginRedirect()
        Entra->>U: Render login UI
        U->>Entra: Enter credentials / OTP
        Entra->>PW: Return RS256 JWT + refresh token
    end
    PW->>IA: GET /api/v1/clusters?min_dpi=60\nAuthorization: Bearer <JWT>
    IA->>IA: authMiddleware\nverify JWT via JWKS endpoint
    IA->>KV: getSecret('database-url') [5-min cache]
    KV-->>IA: connection string
    IA->>DB: SELECT ... FROM anomaly_clusters WHERE dpi_score >= 60
    DB-->>IA: GeoJSON rows
    IA-->>PW: 200 { data: [...], next_cursor: "..." }
    PW-->>U: Render cluster map
```

## MTN MoMo Payment Flow

```mermaid
sequenceDiagram
    participant U as Scout / User
    participant PW as platform-web
    participant PS as payment-service
    participant MTN as MTN MoMo API
    participant SB as Service Bus
    participant NS as notification-service
    participant AT as Africa's Talking SMS

    U->>PW: Submit payment request
    PW->>PS: POST /payment/v1/initiate\n{ amount, currency, phone }
    PS->>PS: validateMomoConfig() — startup guard\nZod validation — request guard
    PS->>MTN: POST /collection/v1_0/requesttopay\nX-Reference-Id: <UUID>
    MTN-->>PS: 202 Accepted
    PS->>PS: BEGIN TRANSACTION\nINSERT payment (status=pending)\nINSERT earnings (status=pending)\nCOMMIT
    PS-->>PW: { paymentId, status: "pending" }
    PW-->>U: "Payment initiated — awaiting confirmation"

    MTN->>PS: POST /callback\n{ status: "SUCCESSFUL" }
    PS->>PS: UPDATE payment status = completed\nUPDATE earnings status = disbursed
    PS->>SB: Publish to payments-completed topic
    SB->>NS: Consume message (peekLock)
    NS->>NS: Lookup scout phone from DB
    NS->>AT: Send SMS
    AT-->>U: "AfriXplore Payment\nGHS 50.00 confirmed.\nRef: ABC12345"
    NS->>SB: completeMessage()
```

## Security Architecture

```mermaid
graph LR
    subgraph Internet["🌐 Public Internet"]
        REQ[Incoming Request]
    end

    subgraph Perimeter["Security Perimeter (per service)"]
        RL[Rate Limiter\nexpress-rate-limit\nauth: 5/15min\ngeneral: 100/15min]
        HM[Helmet\nCSP, HSTS,\nX-Frame-Options,\nX-Content-Type-Options]
        CORS[CORS\nOrigin allowlist]
    end

    subgraph AuthLayer["Authentication Layer"]
        JWKS[JWKS RS256\nJWT Verification\nManaged by Entra CIAM]
        ROLE[Role / Tier Claims\nExtracted from JWT]
    end

    subgraph ValidationLayer["Input Validation (Zod)"]
        BODY[Body Schema]
        QUERY[Query Schema]
        PARAMS[Params Schema\nuuid, ISO codes]
    end

    subgraph Secrets["Secret Management"]
        KV[Azure Key Vault\nManaged Identity\n5-min cache]
        ENV[process.env\nDev fallback only]
    end

    REQ --> RL --> CORS --> HM --> JWKS --> ROLE --> BODY --> Handler
    Handler --> QUERY
    Handler --> PARAMS
    Handler --> KV
    KV -.->|non-production fallback| ENV
```

## Service Dependency Map

```mermaid
graph LR
    subgraph Shared["packages/"]
        TEL[@afrixplore/telemetry]
        CFG[@afrixplore/config]
        VAL[@afrixplore/validation]
        AUTH[@afrixplore/auth]
        HEALTH[@afrixplore/health]
        TYPES[@afrixplore/types]
    end

    IA[intelligence-api] --> TEL & CFG & VAL
    SA[scout-api] --> TEL & CFG & VAL & AUTH
    PS[payment-service] --> TEL & CFG & VAL
    MA[msim-api] --> TEL & CFG & VAL
    AI[ai-inference] --> TEL
    NS[notification-service] --> TEL
    GW[geospatial-worker] --> TEL & TYPES
```
