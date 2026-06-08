import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    var reactNativeDelegate: ReactNativeDelegate?
    var reactNativeFactory: RCTReactNativeFactory?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        AudioSessionController.shared.configureForPlayback()

#if DEBUG
        ReactNativeDelegate.configureDebugBundleProvider()
#endif

        let delegate = ReactNativeDelegate()
        let factory = RCTReactNativeFactory(delegate: delegate)
        delegate.dependencyProvider = RCTAppDependencyProvider()

        reactNativeDelegate = delegate
        reactNativeFactory = factory

        window = UIWindow(frame: UIScreen.main.bounds)

        factory.startReactNative(
            withModuleName: "HertzLabsBinauralBeats",
            in: window,
            launchOptions: launchOptions
        )

        return true
    }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        self.bundleURL()
    }

    override func bundleURL() -> URL? {
#if DEBUG
        let host = ReactNativeDelegate.debugHost()
        return URL(string: "http://\(host):8081/index.bundle?platform=ios&dev=true&minify=false&lazy=true")
#else
        Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
    }

#if DEBUG
    static func debugHost() -> String {
#if targetEnvironment(simulator)
        return "localhost"
#else
        if let ipPath = Bundle.main.path(forResource: "ip", ofType: "txt"),
           let ip = try? String(contentsOfFile: ipPath, encoding: .utf8) {
            let host = ip.trimmingCharacters(in: .whitespacesAndNewlines)
            if !host.isEmpty { return host }
        }
        return "localhost"
#endif
    }

    static func configureDebugBundleProvider() {
        RCTBundleURLProvider.sharedSettings().jsLocation = debugHost()
    }
#endif
}
