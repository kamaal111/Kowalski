//
//  RequiredHeadersMiddleware.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/1/25.
//

import HTTPTypes
import Foundation
import OpenAPIRuntime

struct RequiredHeadersMiddleware {
    private let urlScheme: String?

    init() {
        self.urlScheme = Self.getURLScheme()
    }

    private static func getURLScheme() -> String? {
        guard let infoPlist = Bundle.main.infoDictionary else { return nil }
        guard let urlTypes = infoPlist["CFBundleURLTypes"] as? [[String: Any]] else { return nil }
        guard let firstURLType = urlTypes.first else { return nil }
        guard let urlSchemes = firstURLType["CFBundleURLSchemes"] as? [String] else { return nil }

        return urlSchemes.first
    }
}

// MARK: - ClientMiddleware

extension RequiredHeadersMiddleware: ClientMiddleware {
    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let urlScheme {
            request.headerFields[.origin] = "\(urlScheme)://"
        }

        return try await next(request, body, baseURL)
    }
}
