//
//  KowalskiServerConfiguration.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 4/5/26.
//

import ForexKit
import Foundation

public enum KowalskiServerConfiguration {
    public static func serverURL() -> URL {
        do {
            return try Servers.Server1.url()
        } catch {
            preconditionFailure("Failed to construct server URL: \(error)")
        }
    }

    public static func forexBaseURL() -> URL {
        serverURL()
            .appendingPathComponent(ModuleConfig.appApiPath)
            .appendingPathComponent(ModuleConfig.forexPath)
    }

    public static func defaultForexKitConfiguration() -> ForexKitConfiguration {
        defaultForexKitConfiguration(urlSession: .shared, skipCaching: false)
    }

    public static func defaultForexKitConfiguration(urlSession: URLSession) -> ForexKitConfiguration {
        defaultForexKitConfiguration(urlSession: urlSession, skipCaching: false)
    }

    public static func defaultForexKitConfiguration(
        urlSession: URLSession,
        skipCaching: Bool,
    ) -> ForexKitConfiguration {
        ForexKitConfiguration(skipCaching: skipCaching, urlSession: urlSession, forexBaseURL: forexBaseURL())
    }
}
