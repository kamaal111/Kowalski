//
//  RequestSigner.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 19/12/2024.
//

import Foundation
import HTTPTypes
import KamaalExtensions

enum RequestSigner {
    static func sign(_ request: HTTPRequest, with credentials: Credentials) -> HTTPRequest {
        var request = request
        request.headerFields[.authorization] = "Bearer \(credentials.authToken)"
        var cookies = ["better-auth.session_token=\(credentials.sessionToken)"]
        if let existingCookie = request.headerFields[.cookie] {
            cookies = cookies.prepended(existingCookie)
        }
        request.headerFields[.cookie] = cookies.joined(separator: "; ")
        return request
    }
}
