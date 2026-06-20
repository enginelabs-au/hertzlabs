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
        #if !targetEnvironment(macCatalyst)
        #if targetEnvironment(simulator)
        ReactNativeDelegate.configureDebugBundleProvider()
        #else
        // Physical device: wipe any cached Metro IP so RCTBundleURLProvider
        // doesn't override the embedded-bundle URL we return in bundleURL().
        RCTBundleURLProvider.sharedSettings().jsLocation = nil
        #endif
        #endif
#endif

        let delegate = ReactNativeDelegate()
        let factory = RCTReactNativeFactory(delegate: delegate)
        delegate.dependencyProvider = RCTAppDependencyProvider()

        reactNativeDelegate = delegate
        reactNativeFactory = factory

#if targetEnvironment(macCatalyst)
        window = MacCatalystDesktopWindow.makeWindow()
#else
        window = UIWindow(frame: UIScreen.main.bounds)
#endif

        factory.startReactNative(
            withModuleName: "HertzLabsBinauralBeats",
            in: window,
            launchOptions: launchOptions
        )

#if targetEnvironment(macCatalyst)
        MacCatalystDesktopWindow.configure(window)
#endif

        return true
    }

#if targetEnvironment(macCatalyst)
    func applicationDidBecomeActive(_ application: UIApplication) {
        MacCatalystDesktopWindow.syncFrame(to: window)
    }
#endif
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        self.bundleURL()
    }

    override func bundleURL() -> URL? {
#if targetEnvironment(macCatalyst)
        // Mac desktop install always uses embedded release bundle (no Metro).
        return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#else
#if DEBUG
#if targetEnvironment(simulator)
        // Simulator: Metro for fast refresh.
        let host = ReactNativeDelegate.debugHost()
        return URL(string: "http://\(host):8081/index.bundle?platform=ios&dev=true&minify=false&lazy=true")
#else
        // Physical device: embedded bundle when present (no Metro required).
        if let embedded = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
            return embedded
        }
        let host = ReactNativeDelegate.debugHost()
        return URL(string: "http://\(host):8081/index.bundle?platform=ios&dev=true&minify=false&lazy=true")
#endif
#else
        Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
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
            // Reject loopback/link-local values — they break physical-device Metro.
            if !host.isEmpty,
               !host.hasPrefix("127."),
               !host.hasPrefix("169.254.") {
                return host
            }
        }
        return RCTBundleURLProvider.sharedSettings().jsLocation ?? "localhost"
#endif
    }

    static func configureDebugBundleProvider() {
        RCTBundleURLProvider.sharedSettings().jsLocation = debugHost()
    }
#endif
}
