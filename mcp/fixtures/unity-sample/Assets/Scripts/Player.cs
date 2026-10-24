using UnityEngine;
using System.Collections;

[RequireComponent(typeof(Rigidbody2D))]
public class Player : MonoBehaviour
{
    public static Player Instance { get; private set; }
    [SerializeField] private float speed = 5f;
    [Header("Jump")] public float jumpForce = 10f;
    public int maxHealth = 3;
    public GameObject coinPrefab;
    public AudioClip jumpSfx;
    private Rigidbody2D rb;
    private int score;

    void Awake() { Instance = this; rb = GetComponent<Rigidbody2D>(); }

    void Update()
    {
        float h = Input.GetAxis("Horizontal");
        rb.velocity = new Vector2(h * speed, rb.velocity.y);
        if (Input.GetButtonDown("Jump")) rb.AddForce(Vector2.up * jumpForce, ForceMode2D.Impulse);
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (other.CompareTag("Coin")) { score++; Destroy(other.gameObject); StartCoroutine(Flash()); }
    }

    IEnumerator Flash() { yield return new WaitForSeconds(0.1f); }
}
