//
//  KowalskiClient.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 9/13/25.
//

import Foundation
import KamaalAuth
import KowalskiModels
import OpenAPIRuntime
import OpenAPIURLSession

public struct KowalskiClient: Sendable {
    public let auth: any KamaalAuthClient
    public let stocks: KowalskiStocksClient
    public let portfolio: KowalskiPortfolioClient

    private let client: Client
    private let mapper = KowalskiAuthMapper()

    public var hasValidCredentials: Bool {
        auth.hasValidCredentials
    }

    public static func `default`() -> KowalskiClient {
        let url = KowalskiServerConfiguration.serverURL()
        let credentialsStore = KeychainCredentialsStore()
        let tokenClient = makeTokenClient(url: url, credentialsStore: credentialsStore)
        let hooks = KowalskiAuthRequestHooks(client: tokenClient)
        let tokenProvider = AuthTokenProvider(
            credentialsKey: credentialsKeychainKey,
            credentialsStore: credentialsStore,
        ) {
            await hooks.issueToken()
        }
        let auth = KamaalAuthClientImpl(hooks: hooks, tokenProvider: tokenProvider)

        let client = makeClient(url: url, tokenProvider: tokenProvider)
        let stocks = KowalskiStocksClientFactory.deafault(client: client)
        let portfolio = KowalskiPortfolioClientFactory.default(client: client)

        return KowalskiClient(auth: auth, stocks: stocks, portfolio: portfolio, client: client)
    }

    public static func preview(withCredentials: Bool) -> KowalskiClient {
        let auth = previewAuthClient(withCredentials: withCredentials)
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.preview()

        return KowalskiClient(
            auth: auth,
            stocks: stocks,
            portfolio: portfolio,
            client: makeClient(url: KowalskiServerConfiguration.serverURL(), tokenProvider: nil),
        )
    }

    public static func previewWithFailingPortfolioCreateEntry(withCredentials: Bool) -> KowalskiClient {
        let auth = previewAuthClient(withCredentials: withCredentials)
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.createEntryFailingPreview()

        return KowalskiClient(
            auth: auth,
            stocks: stocks,
            portfolio: portfolio,
            client: makeClient(url: KowalskiServerConfiguration.serverURL(), tokenProvider: nil),
        )
    }

    public static func previewWithValidationFailingPortfolioCreateEntry(withCredentials: Bool) -> KowalskiClient {
        let auth = previewAuthClient(withCredentials: withCredentials)
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.createEntryValidationFailingPreview()

        return KowalskiClient(
            auth: auth,
            stocks: stocks,
            portfolio: portfolio,
            client: makeClient(url: KowalskiServerConfiguration.serverURL(), tokenProvider: nil),
        )
    }

    public static func previewWithPortfolioEntries(withCredentials: Bool) -> KowalskiClient {
        let auth = previewAuthClient(withCredentials: withCredentials)
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.entriesPreview()

        return KowalskiClient(
            auth: auth,
            stocks: stocks,
            portfolio: portfolio,
            client: makeClient(url: KowalskiServerConfiguration.serverURL(), tokenProvider: nil),
        )
    }

    public static func previewWithPortfolioCreateSequence(withCredentials: Bool) -> KowalskiClient {
        let auth = previewAuthClient(withCredentials: withCredentials)
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.createSequencePreview()

        return KowalskiClient(
            auth: auth,
            stocks: stocks,
            portfolio: portfolio,
            client: makeClient(url: KowalskiServerConfiguration.serverURL(), tokenProvider: nil),
        )
    }

    public static func previewWithFailingPortfolioListEntries(withCredentials: Bool) -> KowalskiClient {
        let auth = previewAuthClient(withCredentials: withCredentials)
        let stocks = KowalskiStocksClientFactory.preview()
        let portfolio = KowalskiPortfolioClientFactory.overviewFailingPreview()

        return KowalskiClient(
            auth: auth,
            stocks: stocks,
            portfolio: portfolio,
            client: makeClient(url: KowalskiServerConfiguration.serverURL(), tokenProvider: nil),
        )
    }

    static func testing(
        auth: (any KamaalAuthClient)? = nil,
        stocks: KowalskiStocksClient = KowalskiStocksClientFactory.preview(),
        portfolio: KowalskiPortfolioClient = KowalskiPortfolioClientFactory.preview(),
        client: Client? = nil,
        withCredentials: Bool = false,
    ) -> KowalskiClient {
        KowalskiClient(
            auth: auth ?? previewAuthClient(withCredentials: withCredentials),
            stocks: stocks,
            portfolio: portfolio,
            client: client ?? makeClient(url: KowalskiServerConfiguration.serverURL(), tokenProvider: nil),
        )
    }

    // MARK: Session & Preferences

    public func session() async -> Result<KowalskiAuthSessionResponse, KowalskiAuthSessionErrors> {
        let response: Operations.GetAppApiAuthSession.Output
        do {
            response = try await client.getAppApiAuthSession()
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        let payload: Operations.GetAppApiAuthSession.Output.Ok
        switch response {
        case .unauthorized:
            return .failure(.unauthorized)
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .ok(ok):
            payload = ok
        }

        let jsonPayload: Operations.GetAppApiAuthSession.Output.Ok.Body.JsonPayload
        do {
            jsonPayload = try payload.body.json
        } catch {
            return .failure(.unknown(statusCode: 500, payload: nil, context: error))
        }

        return .success(mapper.mapSessionResponse(
            jsonPayload.value1,
            preferredCurrency: jsonPayload.value2.user.preferredCurrency,
            hasPreferredCurrencyPreference: jsonPayload.value2.user.hasPreferredCurrencyPreference,
        ))
    }

    public func updatePreferences(
        preferredCurrency: KowalskiCurrency,
    ) async -> Result<KowalskiAuthSessionResponse, KowalskiAuthPreferencesErrors> {
        let response: Operations.PatchAppApiAuthPreferences.Output
        do {
            response = try await client.patchAppApiAuthPreferences(
                body: .json(.init(preferredCurrency: .init(preferredCurrency))),
            )
        } catch {
            return .failure(.unknown(statusCode: 503, payload: nil, context: error))
        }

        switch response {
        case .unauthorized:
            return .failure(.unauthorized)
        case .badRequest:
            return .failure(.badRequest)
        case let .undocumented(statusCode, payload):
            return .failure(.unknown(statusCode: statusCode, payload: payload, context: nil))
        case let .ok(ok):
            let body: Operations.PatchAppApiAuthPreferences.Output.Ok.Body.JsonPayload
            do {
                body = try ok.body.json
            } catch {
                return .failure(.unknown(statusCode: 500, payload: nil, context: error))
            }

            return .success(mapper.mapSessionResponse(
                body.value1,
                preferredCurrency: body.value2.user.preferredCurrency,
                hasPreferredCurrencyPreference: body.value2.user.hasPreferredCurrencyPreference,
            ))
        }
    }

    // MARK: Private

    private static let credentialsKeychainKey = ModuleConfig.credentialsKeychainKey

    private static let previewCredentialsKey = "KowalskiClient.previewCredentials"

    private static func previewAuthClient(withCredentials: Bool) -> any KamaalAuthClient {
        let store = InMemoryCredentialsStore()
        if withCredentials {
            let headers = AuthCredentialHeaders(
                authToken: "preview.jwt.token",
                authTokenExpiresInSeconds: 86400,
                sessionToken: "preview_session_token",
                sessionUpdateAgeSeconds: 86400,
            )
            try? store.store(headers.credentials(), forKey: previewCredentialsKey)
        }

        return KamaalAuthClientImpl(
            hooks: PreviewAuthRequestHooks(),
            credentialsKey: previewCredentialsKey,
            credentialsStore: store,
        )
    }

    private static func makeClient(url: URL, tokenProvider: AuthTokenProvider?) -> Client {
        var middlewares: [ClientMiddleware] = []
        if let tokenProvider {
            middlewares.append(AuthorizationMiddleware(tokenProvider: tokenProvider))
        }
        let middlewareToAppend: [ClientMiddleware] = [
            RequiredHeadersMiddleware(),
            LoggingMiddleware(bodyLoggingPolicy: .upTo(maxBytes: ModuleConfig.maxLogSize)),
        ]
        middlewares.append(contentsOf: middlewareToAppend)
        let dateTranscoder = ISO8601DateTranscoder(options: [.withInternetDateTime, .withFractionalSeconds])
        let configuration = Configuration(dateTranscoder: dateTranscoder)
        let transport = URLSessionTransport()

        return Client(
            serverURL: url,
            configuration: configuration,
            transport: transport,
            middlewares: middlewares,
        )
    }

    private static func makeTokenClient(url: URL, credentialsStore: some CredentialsStore) -> Client {
        let middlewares: [any ClientMiddleware] = [
            SessionTokenMiddleware(credentialsKey: credentialsKeychainKey, credentialsStore: credentialsStore),
            RequiredHeadersMiddleware(),
            LoggingMiddleware(bodyLoggingPolicy: .upTo(maxBytes: ModuleConfig.maxLogSize)),
        ]
        let dateTranscoder = ISO8601DateTranscoder(options: [.withInternetDateTime, .withFractionalSeconds])
        let configuration = Configuration(dateTranscoder: dateTranscoder)
        let transport = URLSessionTransport()

        return Client(
            serverURL: url,
            configuration: configuration,
            transport: transport,
            middlewares: middlewares,
        )
    }
}
