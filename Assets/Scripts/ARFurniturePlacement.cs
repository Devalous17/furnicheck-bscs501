using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

public class ARFurniturePlacement : MonoBehaviour
{
    public ARRaycastManager raycastManager;
    public GameObject furniturePrefab;
    public bool buttonMode;
    [Min(0f)] public float groundClearanceMeters = 0.01f;
    [Min(0f)] public float floorHeightToleranceMeters = 0.15f;
    [Min(0.01f)] public float moveStepMeters = 0.05f;

    private GameObject placedFurniture;
    private ARAnchor placedAnchor;
    private bool placementPending;
    private float placedSurfaceY;
    private float placedSurfaceOffset;
    private float rotationDegrees;
    private float CurrentSurfaceY => placedAnchor == null
        ? placedSurfaceY
        : placedAnchor.transform.position.y + placedSurfaceOffset;
    private static readonly List<ARRaycastHit> hits = new();
    private static readonly Vector2[] placementOffsets =
    {
        Vector2.zero,
        new(-0.04f, 0f), new(0.04f, 0f),
        new(0f, -0.04f), new(0f, 0.04f),
        new(-0.04f, -0.04f), new(0.04f, -0.04f),
        new(-0.04f, 0.04f), new(0.04f, 0.04f)
    };
    void OnEnable()
    {
        // Runs every time ARRoot is switched on by the website's "View in AR" button.
        if (WebUIController.SelectedFurniture != null)
            furniturePrefab = WebUIController.SelectedFurniture;

        ClearPlacedFurniture();
    }

    private void ClearPlacedFurniture()
    {
        if (placedFurniture != null)
            Destroy(placedFurniture);
        placedFurniture = null;

        if (placedAnchor != null)
            Destroy(placedAnchor.gameObject);
        placedAnchor = null;
    }

    void Update()
    {
        if (buttonMode)
            return;

        Vector2 screenPosition;

        if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
        {
            screenPosition = Mouse.current.position.ReadValue();
        }
        else if (Touchscreen.current != null &&
                 Touchscreen.current.primaryTouch.press.wasPressedThisFrame)
        {
            screenPosition = Touchscreen.current.primaryTouch.position.ReadValue();
        }
        else
        {
            return;
        }

        if (raycastManager == null || furniturePrefab == null)
            return;

        hits.Clear();
        if (!raycastManager.Raycast(screenPosition, hits, TrackableType.PlaneWithinPolygon))
            return;

        Pose hitPose = hits[0].pose;
        if (placedFurniture == null)
        {
            placedFurniture = Instantiate(furniturePrefab, hitPose.position, Quaternion.identity);
            placedSurfaceY = hitPose.position.y;
            AlignFeetWithSurface(placedFurniture, hitPose.position.y);
        }
        else
        {
            placedFurniture.transform.position = hitPose.position;
            placedSurfaceY = hitPose.position.y;
            AlignFeetWithSurface(placedFurniture, hitPose.position.y);
        }
    }

    // Assign this method to a UI Button's On Click event in the Inspector.
    public async void ToggleFurniture()
    {
        if (placedFurniture != null)
        {
            Destroy(placedFurniture);
            placedFurniture = null;
            if (placedAnchor != null)
                Destroy(placedAnchor.gameObject);
            placedAnchor = null;
            return;
        }

        if (placementPending)
            return;

        if (raycastManager == null || furniturePrefab == null)
        {
            Debug.LogWarning("FurniCheck: Assign the AR Raycast Manager and furniture prefab.");
            return;
        }

        if (!TryFindUpwardSurface(out Pose placementPose))
        {
            Debug.Log("FurniCheck: No detected upward-facing surface near the screen center. Scan the floor and try again.");
            return;
        }

        // An anchor keeps the table tied to the physical spot as AR tracking improves.
        // It belongs on the same XR Origin GameObject as the raycast manager.
        ARAnchorManager anchorManager = raycastManager.GetComponent<ARAnchorManager>();
        if (anchorManager != null && anchorManager.isActiveAndEnabled)
        {
            placementPending = true;
            try
            {
                var result = await anchorManager.TryAddAnchorAsync(
                    new Pose(placementPose.position, Quaternion.identity));
                if (result.status.IsSuccess())
                    placedAnchor = result.value;
                else
                    Debug.LogWarning("FurniCheck: Could not create an AR anchor; placing without one.");
            }
            catch (System.Exception exception)
            {
                Debug.LogWarning($"FurniCheck: Could not create an AR anchor: {exception.Message}");
            }
            finally
            {
                placementPending = false;
            }
        }
        else
        {
            Debug.LogWarning("FurniCheck: Add an AR Anchor Manager to XR Origin for steadier placement.");
        }

        placedFurniture = placedAnchor == null
            ? Instantiate(furniturePrefab, placementPose.position, Quaternion.Euler(0f, rotationDegrees, 0f))
            : Instantiate(furniturePrefab, placementPose.position, Quaternion.Euler(0f, rotationDegrees, 0f), placedAnchor.transform);
        placedSurfaceY = placementPose.position.y;
        placedSurfaceOffset = placedAnchor == null ? 0f : placementPose.position.y - placedAnchor.transform.position.y;
        AlignFeetWithSurface(placedFurniture, CurrentSurfaceY);
    }

    // Aim at another spot on the same floor and press the Move button.
    public void MoveToAimPoint()
    {
        if (placedFurniture == null || raycastManager == null)
            return;

        if (!TryFindUpwardSurface(out Pose pose))
        {
            Debug.Log("FurniCheck: Scan and aim at the floor before moving the table.");
            return;
        }

        if (Mathf.Abs(pose.position.y - CurrentSurfaceY) > floorHeightToleranceMeters)
        {
            Debug.Log("FurniCheck: The new surface is at a different height. Aim at the same floor.");
            return;
        }

        placedFurniture.transform.position = pose.position;
        placedSurfaceY = pose.position.y;
        placedSurfaceOffset = placedAnchor == null ? 0f : pose.position.y - placedAnchor.transform.position.y;
        AlignFeetWithSurface(placedFurniture, CurrentSurfaceY);
    }

    // The four arrow buttons move along the floor, relative to the camera.
    public void NudgeLeft() => Nudge(-1f, 0f);
    public void NudgeRight() => Nudge(1f, 0f);
    public void NudgeForward() => Nudge(0f, 1f);
    public void NudgeBackward() => Nudge(0f, -1f);

    private void Nudge(float rightAmount, float forwardAmount)
    {
        if (placedFurniture == null)
            return;

        Transform cameraTransform = Camera.main == null ? null : Camera.main.transform;
        Vector3 right = cameraTransform == null ? Vector3.right : cameraTransform.right;
        Vector3 forward = cameraTransform == null ? Vector3.forward : cameraTransform.forward;
        right.y = 0f;
        forward.y = 0f;
        if (right.sqrMagnitude < 0.0001f)
            right = Vector3.right;
        if (forward.sqrMagnitude < 0.0001f)
            forward = cameraTransform == null ? Vector3.forward : cameraTransform.up;
        forward.y = 0f;
        if (forward.sqrMagnitude < 0.0001f)
            forward = Vector3.Cross(right, Vector3.up);
        right.Normalize();
        forward.Normalize();

        Vector3 movement = (right * rightAmount + forward * forwardAmount) * moveStepMeters;
        placedFurniture.transform.position += movement;
        AlignFeetWithSurface(placedFurniture, CurrentSurfaceY);
    }

    // Connect a UI Slider with a range of -180 to 180 degrees.
    public void SetRotationDegrees(float degrees)
    {
        rotationDegrees = degrees;
        if (placedFurniture == null)
            return;

        placedFurniture.transform.rotation = Quaternion.Euler(0f, rotationDegrees, 0f);
        AlignFeetWithSurface(placedFurniture, CurrentSurfaceY);
    }

    // ARCore does not identify floors reliably. The user aims at the floor;
    // we accept only an upward-facing detected plane near the screen center.
    private bool TryFindUpwardSurface(out Pose pose)
    {
        ARPlaneManager planeManager = raycastManager.GetComponent<ARPlaneManager>();
        bool foundPlaneHit = false;
        foreach (Vector2 offset in placementOffsets)
        {
            Vector2 screenPoint = new(
                Screen.width * (0.5f + offset.x),
                Screen.height * (0.5f + offset.y));

            hits.Clear();
            if (!raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
                continue;
            foundPlaneHit = true;

            foreach (ARRaycastHit hit in hits)
            {
                ARPlane plane = hit.trackable as ARPlane;
                if (plane == null && planeManager != null)
                    plane = planeManager.GetPlane(hit.trackableId);

                if (plane != null && plane.alignment != PlaneAlignment.HorizontalUp &&
                    plane.alignment != PlaneAlignment.None)
                    continue;

                Vector3 surfaceNormal = hit.pose.rotation * Vector3.up;
                if (Vector3.Dot(surfaceNormal, Vector3.up) < 0.85f)
                    continue;

                pose = hit.pose;
                return true;
            }
        }

        if (foundPlaneHit)
            Debug.Log("FurniCheck: A plane was found, but it is not facing upward.");

        pose = default;
        return false;
    }

    // Imported models often have a centered pivot. Move the root so the actual
    // lowest visible part, usually the feet, rests on the detected surface.
    private void AlignFeetWithSurface(GameObject furniture, float surfaceY)
    {
        Renderer[] renderers = furniture.GetComponentsInChildren<Renderer>(true);
        float lowestPoint = float.PositiveInfinity;
        foreach (Renderer item in renderers)
            lowestPoint = Mathf.Min(lowestPoint, item.bounds.min.y);

        float currentBottom = float.IsPositiveInfinity(lowestPoint)
            ? furniture.transform.position.y
            : lowestPoint;
        Vector3 position = furniture.transform.position;
        position.y += surfaceY + Mathf.Max(0f, groundClearanceMeters) - currentBottom;
        furniture.transform.position = position;
    }
}
