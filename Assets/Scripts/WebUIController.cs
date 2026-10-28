using UnityEngine;
using Gree.UnityWebView;

public class WebUIController : MonoBehaviour
{
    [System.Serializable]
    public class FurnitureEntry { public string id; public GameObject prefab; }

    public FurnitureEntry[] furniture;   // ids: "folding-table", "cabinet"
    public GameObject arRoot;            // parent of AR Session, XR Origin, AR UI

    public static GameObject SelectedFurniture;

    WebViewObject web;

    void Start()
    {
        arRoot.SetActive(false);

#if UNITY_EDITOR
        Debug.Log("WebView only runs on the phone. Use the Test context menu here.");
#else
        web = new GameObject("WebView").AddComponent<WebViewObject>();
        web.Init(cb: OnMessage, err: msg => Debug.LogError("WebView error: " + msg));

        var safe = Screen.safeArea;
        web.SetMargins((int)safe.x, (int)(Screen.height - safe.yMax),
                       (int)(Screen.width - safe.xMax), (int)safe.y);

        web.LoadURL("file:///android_asset/web/index.html");
        web.SetVisibility(true);
#endif
    }

    void OnMessage(string msg)
    {
        if (!msg.StartsWith("openAR:")) return;
        string id = msg.Substring(7);
        foreach (var f in furniture)
            if (f.id == id) { OpenAR(f.prefab); return; }
        Debug.LogWarning("No furniture with id: " + id);
    }

    public void OpenAR(GameObject prefab)
    {
        SelectedFurniture = prefab;
        if (web != null) web.SetVisibility(false);
        arRoot.SetActive(true);
    }

    public void CloseAR()
    {
        arRoot.SetActive(false);
        if (web != null) web.SetVisibility(true);
    }

    [ContextMenu("Test openAR:folding-table")]
    void TestTable() { OnMessage("openAR:folding-table"); }
}