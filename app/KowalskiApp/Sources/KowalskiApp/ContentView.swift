//
//  ContentView.swift
//  KowalskiApp
//
//  Created by Kamaal M Farah on 8/31/25.
//

import SwiftUI

struct EmailSignup: Codable {
    let name: String
    let email: String
    let password: String
}

struct ContentView: View {
    var body: some View {
        VStack {
            Button(action: { Task { await handlePress() }}) {
                Text("Press Me")
            }
        }
        .padding()
    }

    private func handlePress() async {
        var req = URLRequest(url: URL(string: "http://localhost:8080/api/auth/sign-in/email")!)
        req.httpMethod = "POST"
        req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try! JSONEncoder().encode(EmailSignup(name: "John Doe", email: "john@apple.com", password: "password20"))
        let (data, response) = try! await URLSession.shared.data(for: req)
        print("response", response)
        print("data", String(data: data, encoding: .utf8)!)
    }
}

#Preview {
    ContentView()
}
